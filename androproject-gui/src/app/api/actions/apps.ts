import { NextResponse } from 'next/server';
import { safeExec } from './_lib/helpers';
import { ActionContext } from './_lib/context';

interface AppInfo {
  packageName: string;
  name: string;
  size: number;
  date: number;
  isSystem: boolean;
  isBloatware: boolean;
  isHidden: boolean;
  isDisabled: boolean;
  isGoogle: boolean;
}

const BLOATWARE_PATTERNS = /facebook|meta|instagram|messenger|mobikwik|heytap|coloros|gamecenter|quickgame|browser|joyose|payment|xender|shareit|truecaller|cleaner|booster/i;

const GOOGLE_PATTERNS = /^com\.google\.(?!android\.)/i;

const KNOWN_HIDDEN_PACKAGES = new Set([
  'com.coloros.floatassistant',
  'com.oplus.screenrecorder',
  'com.oppo.quicksearch',
]);

// ── List all packages ────────────────────────────────────────────
async function listPackages(adbTarget: string): Promise<string[]> {
  const { out } = await safeExec(`${adbTarget} shell pm list packages -f`, 15000);
  return (out || '').split('\n').filter(Boolean);
}

// ── Get package details ──────────────────────────────────────────
async function getPackageInfo(adbTarget: string, pkg: string): Promise<{
  name: string;
  size: number;
  date: number;
  isSystem: boolean;
  isDisabled: boolean;
}> {
  const { out } = await safeExec(
    `${adbTarget} shell dumpsys package ${pkg} | grep -E 'versionName=|userId=|firstInstallTime='`,
    5000,
  );
  const lines = (out || '').split('\n');

  let name = pkg;
  let isSystem = false;
  let isDisabled = false;

  for (const line of lines) {
    if (line.includes('userId=')) {
      isSystem = line.includes('userId=1') || line.includes('userId=10');
    }
  }

  // Check disabled state
  const { out: stateOut } = await safeExec(
    `${adbTarget} shell pm list packages -d | grep "${pkg}"`,
  );
  isDisabled = (stateOut || '').includes(pkg);

  // Get simple name
  try {
    const { out: labelOut } = await safeExec(
      `${adbTarget} shell dumpsys package ${pkg} | grep 'labelRes'`,
      3000,
    );
    const labelMatch = (labelOut || '').match(/labelRes=0x\w+ nonLocalized=(.+)/);
    if (labelMatch) name = labelMatch[1];
  } catch { /* fallback to package name */ }

  return { name, size: 0, date: Date.now(), isSystem, isDisabled };
}

// ── List running apps ──────────────────────────────────────────
export async function listRunning(ctx: ActionContext) {
  try {
    // Primary: dumpsys activity processes (works on all Android versions)
    const { out: psOut } = await safeExec(
      `${ctx.adbTarget} shell "dumpsys activity processes | grep -E 'proc #|ProcessRecord|processName=' | head -40"`,
      8000,
    );

    let packages: string[] = [];

    if (psOut && psOut.includes('processName=')) {
      // Parse dumpsys output: "processName=com.example.app"
      const matches = psOut.match(/processName=([^\s\n]+)/g) || [];
      packages = matches
        .map(m => m.replace('processName=', '').trim())
        .filter(p => p.includes('.') && !p.startsWith('['));
    } else {
      // Fallback: ps command with compatible flags
      const { out: psFallback } = await safeExec(
        `${ctx.adbTarget} shell "ps -A 2>/dev/null | tail -n +2 | awk '{print $NF}' | head -40"`,
        8000,
      );
      packages = (psFallback || '').split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 3 && l.includes('.'));
    }

    // Deduplicate, filter kernel threads, take top unique
    const unique = [...new Set(packages)]
      .filter(p => !p.startsWith('[') && p.length > 3)
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      running: unique,
      total: unique.length,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Error listing running apps',
      running: [],
      total: 0,
    });
  }
}

// ── Handler ──────────────────────────────────────────────────────
export async function listApps(ctx: ActionContext) {
  try {
    const packages = await listPackages(ctx.adbTarget);
    const apps: AppInfo[] = [];

    for (const line of packages) {
      const parts = line.trim().split('=');
      if (parts.length < 2) continue;
      const apkPath = parts[0];
      const pkgName = parts[1];

      const info = await getPackageInfo(ctx.adbTarget, pkgName);

      const isBloat = BLOATWARE_PATTERNS.test(pkgName);
      const isGoogle = GOOGLE_PATTERNS.test(pkgName);
      const isHidden = KNOWN_HIDDEN_PACKAGES.has(pkgName) ||
        pkgName.includes('.hidden') ||
        (apkPath.includes('/system/') && !pkgName.startsWith('com.google'));

      apps.push({
        packageName: pkgName,
        name: info.name,
        size: info.size,
        date: info.date,
        isSystem: info.isSystem,
        isBloatware: isBloat,
        isHidden,
        isDisabled: info.isDisabled,
        isGoogle,
      });
    }

    return NextResponse.json({ success: true, apps });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Error al listar aplicaciones',
    });
  }
}
