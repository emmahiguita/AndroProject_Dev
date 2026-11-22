// ============================================================================
// ARCHIVO: app-list-builder.ts
// QUÉ HACE: Construye a máxima velocidad el catálogo completo de aplicaciones
//           instaladas en Android combinando consultas ADB en un solo lote y
//           detectando Apps Ocultas sin icono, Adware Overlay, Spyware y Virus.
// CÓMO FUNCIONA:
//   1. Usa `cmd package query-activities -a MAIN -c LAUNCHER` compatible con
//      Android 7–15 (parsea `packageName=` y `pkg/activity` sin depender de `--brief`).
//   2. Distingue módulos internos del SO (`isSystem`) de verdaderas **Apps Ocultas
//      de Usuario (`!isSystem && !launcherSet.has(pkg)`)** y verifica si están
//      corriendo en RAM o interceptando notificaciones.
// POR QUÉ: Garantizar detección 100% real de apps ocultas y amenazas (< 180L).
// ============================================================================

import {
  deriveAppName,
  evaluateHeuristicThreat,
  isBloatwarePackage,
  isCriticalSystem,
  isLegitHeadlessPackage,
  isSafeToRemove,
} from './app-catalog';

type ExecFn = (cmd: string, opts?: { timeout?: number }) => Promise<{ stdout: string }>;

interface CacheEntry {
  timestamp: number;
  apps: any[];
}

const CACHE_TTL_MS = 30_000;
const appListCache = new Map<string, CacheEntry>();

const TRUSTED_STORES = new Set([
  'com.android.vending', 'com.sec.android.app.samsungapps',
  'com.oplus.appmarket', 'com.heytap.market',
  'com.xiaomi.market', 'com.huawei.appmarket',
]);

/** Invalida la caché de aplicaciones de un dispositivo tras instalar/desinstalar/cambiar estado. */
export function invalidateAppListCache(adbTarget?: string) {
  if (adbTarget) appListCache.delete(adbTarget);
  else appListCache.clear();
}

const parsePkgSet = (out: string, stripPrefix = true) =>
  new Set(
    out.trim().split('\n')
      .map((l) => (stripPrefix ? l.replace('package:', '') : l).trim())
      .filter(Boolean),
  );

/** Extrae paquetes con icono LAUNCHER compatible con todas las versiones de Android (7 a 15). */
export function extractLauncherPackages(raw: string): Set<string> {
  const set = new Set<string>();
  const pkgAttrMatches = raw.matchAll(/packageName=([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)/g);
  for (const m of pkgAttrMatches) set.add(m[1]);

  const compMatches = raw.matchAll(/\b([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)\/[a-zA-Z0-9_.$]+/g);
  for (const m of compMatches) set.add(m[1]);
  return set;
}

/** Consulta y clasifica todas las apps del dispositivo Android conectado. */
export async function listDeviceApps(
  adbTarget: string,
  execAsync: ExecFn,
  forceRefresh = false,
) {
  const cached = appListCache.get(adbTarget);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.apps;
  }

  const fastBatchCmd = [
    'pm list packages -s',
    'echo ===SEP===',
    'pm list packages -d',
    'echo ===SEP===',
    'cmd package query-activities -a android.intent.action.MAIN -c android.intent.category.LAUNCHER 2>/dev/null',
    'echo ===SEP===',
    'appops query-op SYSTEM_ALERT_WINDOW allow 2>/dev/null',
    'echo ===SEP===',
    'pm list packages -3 -i 2>/dev/null',
    'echo ===SEP===',
    'settings get secure enabled_accessibility_services 2>/dev/null',
    'echo ===SEP===',
    'settings get secure enabled_notification_listeners 2>/dev/null',
    'echo ===SEP===',
    'dumpsys device_policy 2>/dev/null | grep -E "ComponentInfo|admin="',
    'echo ===SEP===',
    'dumpsys activity processes 2>/dev/null | grep -E "processName=" | head -80',
  ].join('; ');

  const statsCmd =
    `${adbTarget} shell "pm list packages -f | cut -d: -f2- | sed 's/=[^=]*$//' | xargs stat -c '%s|%Y|%n' 2>/dev/null"`;

  const [allRes, batchRes, statsRes] = await Promise.all([
    execAsync(`${adbTarget} shell pm list packages -f`, { timeout: 6000 }),
    execAsync(`${adbTarget} shell "${fastBatchCmd}"`, { timeout: 7000 }).catch(() => ({ stdout: '' })),
    execAsync(statsCmd, { timeout: 7000 }).catch(() => ({ stdout: '' })),
  ]);

  const sections = batchRes.stdout.split('===SEP===');
  const systemSet = parsePkgSet(sections[0] || '');
  const disabledSet = parsePkgSet(sections[1] || '');
  const launcherSet = extractLauncherPackages(sections[2] || '');
  const overlaySet = parsePkgSet(sections[3] || '', false);

  const sideloadSet = new Set<string>();
  const thirdPartySet = new Set<string>();
  for (const line of (sections[4] || '').split('\n')) {
    const m = line.trim().match(/^package:(\S+)(?:\s+installer=(\S+))?/);
    if (m) {
      thirdPartySet.add(m[1]);
      const inst = m[2] || 'null';
      if (inst === 'null' || inst === 'unknown' || !TRUSTED_STORES.has(inst)) sideloadSet.add(m[1]);
    }
  }

  const parseColonServices = (raw: string) => {
    const s = new Set<string>();
    const clean = raw.trim();
    if (!clean || clean === 'null') return s;
    for (const entry of clean.split(':')) {
      const p = entry.split('/')[0]?.trim();
      if (p) s.add(p);
    }
    return s;
  };

  const accessSet = parseColonServices(sections[5] || '');
  const notifSet = parseColonServices(sections[6] || '');
  const adminRaw = sections[7] || '';
  const runningSet = new Set<string>();
  for (const m of (sections[8] || '').matchAll(/processName=([a-zA-Z0-9_.]+)/g)) {
    runningSet.add(m[1]);
  }

  const statsMap = new Map<string, { size: number; date: number }>();
  for (const line of statsRes.stdout.trim().split('\n')) {
    const parts = line.trim().split('|');
    if (parts.length === 3) {
      statsMap.set(parts[2], { size: parseInt(parts[0], 10) || 0, date: (parseInt(parts[1], 10) || 0) * 1000 });
    }
  }

  const apps = [];
  for (const line of allRes.stdout.trim().split('\n')) {
    if (!line.includes('package:') || !line.includes('=')) continue;
    const cleanLine = line.replace('package:', '').trim();
    const equalsIdx = cleanLine.lastIndexOf('=');
    if (equalsIdx === -1) continue;

    const apkPath = cleanLine.substring(0, equalsIdx);
    const pkg = cleanLine.substring(equalsIdx + 1);
    const isSystem = systemSet.has(pkg) && !thirdPartySet.has(pkg);
    const lacksLauncher = launcherSet.size > 0 && !launcherSet.has(pkg);
    // Una app es "Oculta" si es de usuario/terceros sin icono LAUNCHER (no una librería legítima),
    // o si tiene nombre explícito de ocultamiento, o si es sin icono pero tiene overlay/accesibilidad
    const isHidden =
      (!isSystem && lacksLauncher && !isLegitHeadlessPackage(pkg)) ||
      (lacksLauncher && (accessSet.has(pkg) || notifSet.has(pkg))) ||
      /(?:^|\.)(hidden|stealth|invisible|spy|hiddad)/i.test(pkg);

    const hasOverlay = overlaySet.has(pkg);
    const threat = evaluateHeuristicThreat({
      pkg, isSystem, isHidden, hasOverlay,
      hasAccessibility: accessSet.has(pkg),
      isDeviceAdmin: adminRaw.includes(`${pkg}/`),
      isSideloaded: sideloadSet.has(pkg),
      hasNotificationAccess: notifSet.has(pkg),
      isRunningInBg: runningSet.has(pkg),
    });
    const stats = statsMap.get(apkPath) || { size: 0, date: 0 };

    apps.push({
      packageName: pkg, name: deriveAppName(apkPath, pkg), apkPath, isSystem,
      isBloatware: isBloatwarePackage(pkg, isSystem), isHidden, hasOverlay,
      isDisabled: disabledSet.has(pkg), size: stats.size, date: stats.date,
      isGoogle: pkg.startsWith('com.google.android.') || pkg.startsWith('com.google.mainline.') || pkg === 'com.android.vending',
      isMalware: threat !== null, threatName: threat ? threat.threatName : '',
      threatSeverity: threat ? threat.severity : '',
      safeToRemove: isSafeToRemove(pkg, isSystem) || Boolean(threat) || isHidden,
      criticalSystem: isCriticalSystem(pkg),
    });
  }

  apps.sort((a, b) => {
    if (a.isMalware !== b.isMalware) return a.isMalware ? -1 : 1;
    if (a.isHidden !== b.isHidden) return a.isHidden ? -1 : 1;
    if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  appListCache.set(adbTarget, { timestamp: Date.now(), apps });
  return apps;
}
