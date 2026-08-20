/**
 * Binary discovery utilities.
 * Extracted from config.ts — Single Responsibility: discover binaries on the system.
 */
import fs from 'fs';
import path from 'path';
import { ANDROPROJECT_HOME } from './paths';

// ── scrcpy / AndroProject.exe discovery ─────────────────────────
function findWingetScrcpy(): string {
  const packagesRoot = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft', 'WinGet', 'Packages',
  );
  try {
    for (const packageName of fs.readdirSync(packagesRoot)) {
      if (!packageName.startsWith('Genymobile.scrcpy_')) continue;
      const packageRoot = path.join(packagesRoot, packageName);
      for (const releaseName of fs.readdirSync(packageRoot)) {
        const candidate = path.join(packageRoot, releaseName, 'scrcpy.exe');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  } catch { /* WinGet not installed */ }
  return path.join(packagesRoot, 'scrcpy.exe');
}

export function discoverAndroprojectBin(): string {
  const envPath = process.env.ANDROPROJECT_BIN_PATH;
  const candidates = envPath
    ? [envPath, findWingetScrcpy(), 'scrcpy']
    : [
        path.join(ANDROPROJECT_HOME, 'AndroProject.exe'),
        path.join(ANDROPROJECT_HOME, 'scrcpy.exe'),
        findWingetScrcpy(),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'scrcpy', 'scrcpy.exe'),
        'scrcpy',
      ];
  return candidates.find((c) => fs.existsSync(c)) || candidates[candidates.length - 1];
}

// Re-exported for backward compatibility with config.ts
export const ANDROPROJECT_BIN = discoverAndroprojectBin();
