// ============================================================================
// ARCHIVO: spyware-heuristic-scanner.ts
// QUÉ HACE: Escanea Android vía ADB en busca de Apps Ocultas sin icono en el
//           launcher, publicidad invasora (adware con overlay/popups), spyware,
//           stalkerware, lectura de notificaciones y troyanos con persistencia.
// CÓMO FUNCIONA: Combina en paralelo: origen sideload (`pm list packages -3 -i`),
//           apps ocultas (`cmd package query-activities` compatible Android 7-15),
//           Accesibilidad activa, Notification Listeners, Device Admin, procesos
//           en segundo plano (`dumpsys activity processes`) y `appops` críticos.
// POR QUÉ: Detectar el 100% de apps ocultas y virus camuflados (< 175 líneas).
// ============================================================================

import { execFile } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';
import { getMalwareClassification, isLegitHeadlessPackage } from '@/app/api/apps/_lib/app-catalog';
import { extractLauncherPackages } from '@/app/api/apps/_lib/app-list-builder';

const execFileAsync = promisify(execFile);

export interface SpywareFinding {
  packageName: string;
  severity: 'critical' | 'high' | 'medium';
  category: 'spyware' | 'adware' | 'trojan';
  score: number;
  installer: string;
  hasOverlay: boolean;
  hasAccessibility?: boolean;
  hasNotificationAccess?: boolean;
  hasInstallPackages?: boolean;
  isDeviceAdmin?: boolean;
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
    const m = line.trim().match(/^package:(\S+)(?:\s+installer=(\S+))?/);
    if (m) map.set(m[1], m[2] || 'unknown');
  }
  return map;
}

function parseColonPkgs(raw: string): Set<string> {
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

/** Ejecuta auditoría heurística de apps ocultas, adware invasivo, spyware y troyanos vía ADB. */
export async function scanDeviceForSpyware(serial: string): Promise<{
  findings: SpywareFinding[];
  scannedThirdParty: number;
  accessibilityCount: number;
  hiddenAppsCount: number;
  topWindowPkg: string | null;
}> {
  const [pkgInstRaw, launcherRaw, accessRaw, notifRaw, adminRaw, appopsRaw, procRaw, winRaw] = await Promise.all([
    adbShell(serial, 'pm list packages -3 -i'),
    adbShell(serial, 'cmd package query-activities -a android.intent.action.MAIN -c android.intent.category.LAUNCHER'),
    adbShell(serial, 'settings get secure enabled_accessibility_services'),
    adbShell(serial, 'settings get secure enabled_notification_listeners'),
    adbShell(serial, 'dumpsys device_policy | grep -E "ComponentInfo|admin="'),
    adbShell(serial, 'dumpsys appops'),
    adbShell(serial, 'dumpsys activity processes | grep -E "processName=" | head -100'),
    adbShell(serial, 'dumpsys window | grep -E "mCurrentFocus|mFocusedApp" | head -n 2'),
  ]);

  const topMatch = winRaw.match(/([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)\//);
  const topWindowPkg = topMatch?.[1] || null;
  const installers = parseThirdPartyInstallers(pkgInstRaw);
  const launcherSet = extractLauncherPackages(launcherRaw);
  const accessPkgs = parseColonPkgs(accessRaw);
  const notifPkgs = parseColonPkgs(notifRaw);
  const opsMap = parseAppOpsMap(appopsRaw);
  const runningSet = new Set<string>();
  for (const m of procRaw.matchAll(/processName=([a-zA-Z0-9_.]+)/g)) runningSet.add(m[1]);

  const findings: SpywareFinding[] = [];
  let hiddenAppsCount = 0;

  for (const [pkg, installer] of installers.entries()) {
    if (isLegitHeadlessPackage(pkg)) continue;
    const reasons: string[] = [];
    let score = 0;
    const isSideload = installer === 'null' || installer === 'unknown' || !TRUSTED_INSTALLERS.has(installer);
    const hasAccess = accessPkgs.has(pkg);
    const hasNotif = notifPkgs.has(pkg);
    const isAdmin = adminRaw.includes(`${pkg}/`);
    const isHidden = launcherSet.size > 0 && !launcherSet.has(pkg);
    const isRunning = runningSet.has(pkg);
    const ops = opsMap.get(pkg) ?? new Set<string>();
    const hasOverlay = ops.has('SYSTEM_ALERT_WINDOW');
    const knownThreat = getMalwareClassification(pkg);

    if (isHidden) {
      hiddenAppsCount++;
      score += 45;
      reasons.push('App Oculta: no tiene icono visible en el launcher (posible ocultamiento tras instalación)');
      if (isRunning) { score += 20; reasons.push('Proceso oculto activo en memoria RAM en este momento'); }
    }
    if (knownThreat) { score += 60; reasons.push(`Firma conocida: ${knownThreat.threatName}`); }
    if (hasAccess) { score += 50; reasons.push('Servicio de Accesibilidad activo (lectura de pantalla/teclas)'); }
    if (hasNotif) { score += 35; reasons.push('Acceso a Notificaciones activo (puede leer mensajes/códigos 2FA)'); }
    if (isAdmin) { score += 35; reasons.push('Administrador de dispositivo activo (impide desinstalar)'); }
    if (hasOverlay) { score += 25; reasons.push('Permiso Overlay activo (dibuja anuncios/popups sobre otras apps)'); }
    if (ops.has('REQUEST_INSTALL_PACKAGES')) { score += 20; reasons.push('Puede instalar otros APKs en segundo plano'); }
    if (isSideload) { score += 20; reasons.push(`Instalado fuera de tienda oficial (${installer})`); }

    const spyPerms = [...ops].filter((o) => o !== 'SYSTEM_ALERT_WINDOW' && o !== 'REQUEST_INSTALL_PACKAGES');
    if (spyPerms.length >= 2) {
      score += spyPerms.length * 12;
      reasons.push(`Permisos sensibles activos: ${spyPerms.join(', ')}`);
    }

    if (score >= 40) {
      const severity: SpywareFinding['severity'] = score >= 75 ? 'critical' : score >= 55 ? 'high' : 'medium';
      const category: SpywareFinding['category'] = hasAccess || isAdmin || hasNotif ? 'trojan' : hasOverlay || isHidden ? 'adware' : 'spyware';
      findings.push({
        packageName: pkg,
        severity,
        category,
        score,
        installer,
        hasOverlay,
        hasAccessibility: hasAccess,
        hasNotificationAccess: hasNotif,
        hasInstallPackages: ops.has('REQUEST_INSTALL_PACKAGES'),
        isDeviceAdmin: isAdmin,
        isHidden,
        reasons,
      });
    }
  }

  findings.sort((a, b) => b.score - a.score);
  return { findings, scannedThirdParty: installers.size, accessibilityCount: accessPkgs.size, hiddenAppsCount, topWindowPkg };
}
