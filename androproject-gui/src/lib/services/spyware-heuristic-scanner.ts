// ============================================================================
// ARCHIVO: spyware-heuristic-scanner.ts
// QUÉ HACE: Escanea Android vía ADB en busca de publicidad invasora (adware
//           con overlay/popups sin icono), spyware, troyanos y persistencia.
// CÓMO FUNCIONA: Combina en paralelo: origen sideload (`pm list packages -3 -i`),
//           apps ocultas sin launcher (`cmd package query-activities`),
//           Accesibilidad activa, Device Admin, `appops` críticos y ventana
//           activa en primer plano (`dumpsys window`).
// POR QUÉ: Detectar adware/virus camuflados en el dispositivo real (< 200L).
// ============================================================================

import { execFile } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';

const execFileAsync = promisify(execFile);

export interface SpywareFinding {
  packageName: string;
  severity: 'critical' | 'high' | 'medium';
  category: 'spyware' | 'adware' | 'trojan';
  score: number;
  installer: string;
  hasOverlay: boolean;
  isHidden: boolean;
  reasons: string[];
}

const TRUSTED_INSTALLERS = new Set([
  'com.android.vending', 'com.sec.android.app.samsungapps',
  'com.oplus.appmarket', 'com.heytap.market',
  'com.xiaomi.market', 'com.huawei.appmarket',
]);

const SPY_OPS = [
  'READ_SMS', 'RECEIVE_SMS', 'RECORD_AUDIO', 'CAMERA',
  'FINE_LOCATION', 'READ_CALL_LOG', 'SYSTEM_ALERT_WINDOW', 'REQUEST_INSTALL_PACKAGES',
];

async function adbShell(serial: string, cmd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(ADB, ['-s', serial, 'shell', cmd], {
      timeout: 8000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
    });
    return String(stdout || '');
  } catch { return ''; }
}

function parseThirdPartyInstallers(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of raw.split('\n')) {
    const m = line.trim().match(/^package:(\S+)\s+installer=(\S+)/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

function parseLauncherSet(raw: string): Set<string> {
  const set = new Set<string>();
  for (const line of raw.split('\n')) {
    const pkg = line.trim().split('/')[0];
    if (pkg) set.add(pkg);
  }
  return set;
}

function parseAccessibilityPkgs(raw: string): Set<string> {
  const set = new Set<string>();
  const clean = raw.trim();
  if (!clean || clean === 'null') return set;
  for (const entry of clean.split(':')) {
    const pkg = entry.split('/')[0]?.trim();
    if (pkg) set.add(pkg);
  }
  return set;
}

function parseAppOpsMap(raw: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  let current = '';
  for (const line of raw.split('\n')) {
    const pkgMatch = line.match(/^\s*Package\s+(\S+):/);
    if (pkgMatch) { current = pkgMatch[1]; continue; }
    if (!current || (!line.includes('allow') && !line.includes('foreground'))) continue;
    for (const op of SPY_OPS) {
      if (line.includes(op)) {
        if (!map.has(current)) map.set(current, new Set());
        map.get(current)!.add(op);
      }
    }
  }
  return map;
}

/** Ejecuta auditoría heurística de adware invasivo, spyware y troyanos vía ADB. */
export async function scanDeviceForSpyware(serial: string): Promise<{
  findings: SpywareFinding[];
  scannedThirdParty: number;
  accessibilityCount: number;
  topWindowPkg: string | null;
}> {
  const [pkgInstRaw, launcherRaw, accessRaw, adminRaw, appopsRaw, winRaw] = await Promise.all([
    adbShell(serial, 'pm list packages -3 -i'),
    adbShell(serial, 'cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER'),
    adbShell(serial, 'settings get secure enabled_accessibility_services'),
    adbShell(serial, 'dumpsys device_policy | grep -E "ComponentInfo|admin="'),
    adbShell(serial, 'dumpsys appops'),
    adbShell(serial, 'dumpsys window | grep -E "mCurrentFocus|mFocusedApp" | head -n 2'),
  ]);

  const topMatch = winRaw.match(/([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)\//);
  const topWindowPkg = topMatch?.[1] || null;
  const installers = parseThirdPartyInstallers(pkgInstRaw);
  const launcherSet = parseLauncherSet(launcherRaw);
  const accessPkgs = parseAccessibilityPkgs(accessRaw);
  const opsMap = parseAppOpsMap(appopsRaw);
  const findings: SpywareFinding[] = [];

  for (const [pkg, installer] of installers.entries()) {
    const reasons: string[] = [];
    let score = 0;
    const isSideload = installer === 'null' || !TRUSTED_INSTALLERS.has(installer);
    const hasAccess = accessPkgs.has(pkg);
    const isAdmin = adminRaw.includes(`${pkg}/`);
    const isHidden = launcherSet.size > 0 && !launcherSet.has(pkg);
    const ops = opsMap.get(pkg) ?? new Set<string>();
    const hasOverlay = ops.has('SYSTEM_ALERT_WINDOW');

    if (hasAccess) { score += 50; reasons.push('Servicio de Accesibilidad activo (lectura de pantalla/teclas)'); }
    if (isAdmin) { score += 35; reasons.push('Administrador de dispositivo activo (impide desinstalar)'); }
    if (isHidden) { score += 25; reasons.push('App oculta (sin ícono visible en el launcher)'); }
    if (hasOverlay) { score += 25; reasons.push('Permiso Overlay activo (dibuja anuncios sobre otras apps)'); }
    if (ops.has('REQUEST_INSTALL_PACKAGES')) { score += 20; reasons.push('Puede instalar otros APKs en segundo plano'); }
    if (isSideload) { score += 20; reasons.push(`Instalado fuera de tienda oficial (${installer})`); }

    const spyPerms = [...ops].filter((o) => o !== 'SYSTEM_ALERT_WINDOW' && o !== 'REQUEST_INSTALL_PACKAGES');
    if (spyPerms.length >= 2) {
      score += spyPerms.length * 12;
      reasons.push(`Permisos sensibles activos: ${spyPerms.join(', ')}`);
    }

    if (score >= 40) {
      const severity: SpywareFinding['severity'] = score >= 75 ? 'critical' : score >= 55 ? 'high' : 'medium';
      const category: SpywareFinding['category'] = hasAccess || isAdmin ? 'trojan' : hasOverlay || isHidden ? 'adware' : 'spyware';
      findings.push({ packageName: pkg, severity, category, score, installer, hasOverlay, isHidden, reasons });
    }
  }

  findings.sort((a, b) => b.score - a.score);
  return { findings, scannedThirdParty: installers.size, accessibilityCount: accessPkgs.size, topWindowPkg };
}
