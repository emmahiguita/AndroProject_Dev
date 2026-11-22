// ============================================================================
// ARCHIVO: app-list-builder.ts
// QUÉ HACE: Consulta en paralelo los paquetes instalados en Android vía ADB
//           (`pm list`, `dumpsys appops`, `stat`) y construye la lista ordenada.
// CÓMO FUNCIONA: Ejecuta 6 comandos ADB concurrentes con timeouts acotados,
//           cruza permisos de overlay, estado deshabilitado y clasifica con
//           `app-catalog.ts`.
// POR QUÉ: Aislar la lógica de listado mantiene `apps/route.ts` bajo 200L (SRP).
// ============================================================================

import {
  deriveAppName,
  getMalwareClassification,
  isBloatwarePackage,
  isCriticalSystem,
  isSafeToRemove,
} from './app-catalog';

type ExecFn = (cmd: string, opts?: { timeout?: number }) => Promise<{ stdout: string }>;

const parsePkgSet = (out: string, stripPrefix = true) =>
  new Set(
    out.trim().split('\n')
      .map((l) => (stripPrefix ? l.replace('package:', '') : l).trim())
      .filter(Boolean),
  );

/** Consulta y clasifica todas las apps del dispositivo Android conectado. */
export async function listDeviceApps(adbTarget: string, execAsync: ExecFn) {
  const launcherCmd =
    'cmd package query-activities -c android.intent.category.LAUNCHER -a android.intent.action.MAIN | grep packageName= | cut -d= -f2 | sort -u';
  const statsCmd =
    `${adbTarget} shell "pm list packages -f | cut -d: -f2- | sed 's/=[^=]*$//' | xargs stat -c '%s|%Y|%n' 2>/dev/null"`;

  const [allRes, sysRes, disRes, launcherRes, appopsRes, statsRes] = await Promise.all([
    execAsync(`${adbTarget} shell pm list packages -f`, { timeout: 6000 }),
    execAsync(`${adbTarget} shell pm list packages -s`, { timeout: 4000 }).catch(() => ({ stdout: '' })),
    execAsync(`${adbTarget} shell pm list packages -d`, { timeout: 4000 }).catch(() => ({ stdout: '' })),
    execAsync(`${adbTarget} shell "${launcherCmd}"`, { timeout: 5000 }).catch(() => ({ stdout: '' })),
    execAsync(`${adbTarget} shell dumpsys appops`, { timeout: 8000 }).catch(() => ({ stdout: '' })),
    execAsync(statsCmd, { timeout: 10000 }).catch(() => ({ stdout: '' })),
  ]);

  const systemSet = parsePkgSet(sysRes.stdout);
  const disabledSet = parsePkgSet(disRes.stdout);
  const launcherSet = parsePkgSet(launcherRes.stdout, false);

  const overlaySet = new Set<string>();
  let currentPkg = '';
  for (const line of appopsRes.stdout.split('\n')) {
    const pkgMatch = line.match(/^\s*Package\s+(\S+):/);
    if (pkgMatch) currentPkg = pkgMatch[1];
    else if (line.includes('SYSTEM_ALERT_WINDOW') && (line.includes('allow') || line.includes('default')) && currentPkg) {
      overlaySet.add(currentPkg);
    }
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
    const isSystem = systemSet.has(pkg);
    const malware = getMalwareClassification(pkg);
    const stats = statsMap.get(apkPath) || { size: 0, date: 0 };

    apps.push({
      packageName: pkg,
      name: deriveAppName(apkPath, pkg),
      apkPath,
      isSystem,
      isBloatware: isBloatwarePackage(pkg, isSystem),
      isHidden: !launcherSet.has(pkg),
      hasOverlay: overlaySet.has(pkg),
      isDisabled: disabledSet.has(pkg),
      size: stats.size,
      date: stats.date,
      isGoogle: pkg.startsWith('com.google.android.') || pkg.startsWith('com.google.mainline.') || pkg === 'com.android.vending',
      isMalware: malware !== null,
      threatName: malware ? malware.threatName : '',
      threatSeverity: malware ? malware.severity : '',
      safeToRemove: isSafeToRemove(pkg, isSystem),
      criticalSystem: isCriticalSystem(pkg),
    });
  }

  apps.sort((a, b) => (a.isSystem !== b.isSystem ? (a.isSystem ? 1 : -1) : a.name.localeCompare(b.name)));
  return apps;
}
