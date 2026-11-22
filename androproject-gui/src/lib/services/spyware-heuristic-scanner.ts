// ============================================================================
// ARCHIVO: spyware-heuristic-scanner.ts
// QUÉ HACE: Analiza aplicaciones Android reales en busca de spyware, adware y
//           troyanos por comportamiento (sin depender solo del nombre del APK).
// CÓMO FUNCIONA: Consulta vía ADB en paralelo: origen de instalación (sideload
//           fuera de Play Store), Servicios de Accesibilidad activos, Device
//           Admins y permisos críticos (`appops`: micrófono, SMS, ubicación,
//           cámara, registro de llamadas y overlay `SYSTEM_ALERT_WINDOW`).
// POR QUÉ: Detectar amenazas reales aunque usen nombres genéricos (< 200L).
// ============================================================================

import { execFile } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';

const execFileAsync = promisify(execFile);

export interface SpywareFinding {
  packageName: string;
  severity: 'critical' | 'high' | 'medium';
  score: number;
  installer: string;
  reasons: string[];
}

const TRUSTED_INSTALLERS = new Set([
  'com.android.vending',
  'com.sec.android.app.samsungapps',
  'com.oplus.appmarket',
  'com.heytap.market',
  'com.xiaomi.market',
  'com.huawei.appmarket',
]);

const SPY_OPS = ['READ_SMS', 'RECEIVE_SMS', 'RECORD_AUDIO', 'CAMERA', 'FINE_LOCATION', 'READ_CALL_LOG', 'SYSTEM_ALERT_WINDOW'];

async function adbShell(serial: string, cmd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(ADB, ['-s', serial, 'shell', cmd], {
      timeout: 8000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    return String(stdout || '');
  } catch {
    return '';
  }
}

/** Parsea `pm list packages -3 -i` devolviendo mapa pkg -> instalador. */
function parseThirdPartyInstallers(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of raw.split('\n')) {
    const m = line.trim().match(/^package:(\S+)\s+installer=(\S+)/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

/** Extrae paquetes con Servicio de Accesibilidad activo en `enabled_accessibility_services`. */
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

/** Parsea `appops` agrupando permisos sensibles activos por paquete. */
function parseAppOpsMap(raw: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  let current = '';
  for (const line of raw.split('\n')) {
    const pkgMatch = line.match(/^\s*Package\s+(\S+):/);
    if (pkgMatch) {
      current = pkgMatch[1];
      continue;
    }
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

/** Ejecuta auditoría heurística completa de spyware/adware sobre un Android vía ADB. */
export async function scanDeviceForSpyware(serial: string): Promise<{
  findings: SpywareFinding[];
  scannedThirdParty: number;
  accessibilityCount: number;
}> {
  const [pkgInstRaw, accessRaw, adminRaw, appopsRaw] = await Promise.all([
    adbShell(serial, 'pm list packages -3 -i'),
    adbShell(serial, 'settings get secure enabled_accessibility_services'),
    adbShell(serial, 'dumpsys device_policy | grep -E "ComponentInfo|admin="'),
    adbShell(serial, 'dumpsys appops'),
  ]);

  const installers = parseThirdPartyInstallers(pkgInstRaw);
  const accessPkgs = parseAccessibilityPkgs(accessRaw);
  const opsMap = parseAppOpsMap(appopsRaw);
  const findings: SpywareFinding[] = [];

  for (const [pkg, installer] of installers.entries()) {
    const reasons: string[] = [];
    let score = 0;
    const isSideload = installer === 'null' || !TRUSTED_INSTALLERS.has(installer);
    const hasAccess = accessPkgs.has(pkg);
    const isAdmin = adminRaw.includes(`${pkg}/`);
    const ops = opsMap.get(pkg) ?? new Set<string>();

    if (hasAccess) { score += 50; reasons.push('Servicio de Accesibilidad activo (lectura de pantalla/teclas)'); }
    if (isAdmin) { score += 35; reasons.push('Administrador de dispositivo activo (bloquea desinstalación)'); }
    if (isSideload) { score += 20; reasons.push(`Instalado fuera de tienda oficial (${installer})`); }
    if (ops.has('SYSTEM_ALERT_WINDOW')) { score += 20; reasons.push('Permiso de superposición sobre apps (Overlay/Adware)'); }

    const spyPerms = [...ops].filter((o) => o !== 'SYSTEM_ALERT_WINDOW');
    if (spyPerms.length >= 2) {
      score += spyPerms.length * 12;
      reasons.push(`Permisos sensibles activos: ${spyPerms.join(', ')}`);
    }

    if (score >= 40) {
      const severity: SpywareFinding['severity'] = score >= 75 ? 'critical' : score >= 55 ? 'high' : 'medium';
      findings.push({ packageName: pkg, severity, score, installer, reasons });
    }
  }

  findings.sort((a, b) => b.score - a.score);
  return { findings, scannedThirdParty: installers.size, accessibilityCount: accessPkgs.size };
}
