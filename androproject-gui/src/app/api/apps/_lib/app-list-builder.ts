// ============================================================================
// ARCHIVO: app-list-builder.ts
// QUÉ HACE: Construye a máxima velocidad el catálogo completo de aplicaciones
//           instaladas en Android combinando consultas ADB en un solo lote y
//           evaluando heurísticamente Adware, Spyware, Virus, Overlay y Ocultas.
// CÓMO FUNCIONA:
//   1. Si existe caché fresca (<30s) y no se pidió `forceRefresh`, responde en <1ms.
//   2. Ejecuta en un único lote ADB: `pm list -s`, `-d`, `-3 -i` (instalador),
//      `query-activities --brief` (apps sin icono), `appops SYSTEM_ALERT_WINDOW`,
//      `enabled_accessibility_services` y `device_policy`.
// POR QUÉ: Detectar publicidad invasiva, spyware y virus reales en ~350ms sin
//          múltiples viajes ADB y manteniendo < 165 líneas (SRP).
// ============================================================================

import {
  deriveAppName,
  evaluateHeuristicThreat,
  isBloatwarePackage,
  isCriticalSystem,
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

  // Un solo comando compuesto por ADB trae sistema, deshabilitadas, launchers,
  // overlays publicitarios, instaladores (sideload), accesibilidad y device admin
  const fastBatchCmd = [
    'pm list packages -s',
    'echo ===SEP===',
    'pm list packages -d',
    'echo ===SEP===',
    'cmd package query-activities --brief -c android.intent.category.LAUNCHER -a android.intent.action.MAIN 2>/dev/null',
    'echo ===SEP===',
    'appops query-op SYSTEM_ALERT_WINDOW allow 2>/dev/null',
    'echo ===SEP===',
    'pm list packages -3 -i 2>/dev/null',
    'echo ===SEP===',
    'settings get secure enabled_accessibility_services 2>/dev/null',
    'echo ===SEP===',
    'dumpsys device_policy 2>/dev/null | grep -E "ComponentInfo|admin="',
  ].join('; ');

  const statsCmd =
    `${adbTarget} shell "pm list packages -f | cut -d: -f2- | sed 's/=[^=]*$//' | xargs stat -c '%s|%Y|%n' 2>/dev/null"`;

  const [allRes, batchRes, statsRes] = await Promise.all([
    execAsync(`${adbTarget} shell pm list packages -f`, { timeout: 6000 }),
    execAsync(`${adbTarget} shell "${fastBatchCmd}"`, { timeout: 6500 }).catch(() => ({ stdout: '' })),
    execAsync(statsCmd, { timeout: 7000 }).catch(() => ({ stdout: '' })),
  ]);

  const sections = batchRes.stdout.split('===SEP===');
  const systemSet = parsePkgSet(sections[0] || '');
  const disabledSet = parsePkgSet(sections[1] || '');

  const launcherSet = new Set<string>();
  for (const line of (sections[2] || '').split('\n')) {
    const trimmed = line.trim();
    const slashIdx = trimmed.indexOf('/');
    if (slashIdx > 0 && !trimmed.includes(' ')) {
      launcherSet.add(trimmed.substring(0, slashIdx));
    }
  }

  const overlaySet = parsePkgSet(sections[3] || '', false);

  const sideloadSet = new Set<string>();
  for (const line of (sections[4] || '').split('\n')) {
    const m = line.trim().match(/^package:(\S+)(?:\s+installer=(\S+))?/);
    if (m) {
      const inst = m[2] || 'null';
      if (inst === 'null' || inst === 'unknown' || !TRUSTED_STORES.has(inst)) {
        sideloadSet.add(m[1]);
      }
    }
  }

  const accessSet = new Set<string>();
  const accessRaw = (sections[5] || '').trim();
  if (accessRaw && accessRaw !== 'null') {
    for (const entry of accessRaw.split(':')) {
      const p = entry.split('/')[0]?.trim();
      if (p) accessSet.add(p);
    }
  }

  const adminRaw = sections[6] || '';

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
    const isSystem = systemSet.has(pkg);
    const isHidden = launcherSet.size > 0 ? !launcherSet.has(pkg) : false;
    const hasOverlay = overlaySet.has(pkg);
    const isSideloaded = sideloadSet.has(pkg);
    const hasAccessibility = accessSet.has(pkg);
    const isDeviceAdmin = adminRaw.includes(`${pkg}/`);

    const threat = evaluateHeuristicThreat({
      pkg, isSystem, isHidden, hasOverlay, hasAccessibility, isDeviceAdmin, isSideloaded,
    });
    const stats = statsMap.get(apkPath) || { size: 0, date: 0 };

    apps.push({
      packageName: pkg,
      name: deriveAppName(apkPath, pkg),
      apkPath,
      isSystem,
      isBloatware: isBloatwarePackage(pkg, isSystem),
      isHidden,
      hasOverlay,
      isDisabled: disabledSet.has(pkg),
      size: stats.size,
      date: stats.date,
      isGoogle: pkg.startsWith('com.google.android.') || pkg.startsWith('com.google.mainline.') || pkg === 'com.android.vending',
      isMalware: threat !== null,
      threatName: threat ? threat.threatName : '',
      threatSeverity: threat ? threat.severity : '',
      safeToRemove: isSafeToRemove(pkg, isSystem) || Boolean(threat),
      criticalSystem: isCriticalSystem(pkg),
    });
  }

  apps.sort((a, b) => {
    if (a.isMalware !== b.isMalware) return a.isMalware ? -1 : 1;
    if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  appListCache.set(adbTarget, { timestamp: Date.now(), apps });
  return apps;
}
