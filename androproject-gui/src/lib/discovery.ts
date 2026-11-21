// ============================================================================
// ARCHIVO: discovery.ts
// QUÉ HACE: Localiza automáticamente binarios críticos (scrcpy.exe y scrcpy-server)
//           en rutas locales de C:\AndroProject, WinGet y variables de entorno.
// CÓMO FUNCIONA: Escanea rutas candidatas deterministas y devuelve la primera válida.
// POR QUÉ: Evitar errores de "archivo no encontrado" al iniciar sesiones de streaming.
// ============================================================================
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

export function discoverScrcpyServer(): string {
  const envPath = process.env.ANDROPROJECT_SERVER_PATH;
  const binCandidate = discoverAndroprojectBin();
  const binDir = path.dirname(binCandidate);
  const candidates = envPath
    ? [envPath, path.join(binDir, 'scrcpy-server'), path.join(ANDROPROJECT_HOME, 'scrcpy-server')]
    : [
        path.join(ANDROPROJECT_HOME, 'scrcpy-server'),
        path.join(binDir, 'scrcpy-server'),
        path.join(ANDROPROJECT_HOME, 'scrcpy-server.jar'),
      ];
  return candidates.find((c) => fs.existsSync(c)) || candidates[0];
}

// Re-exported for backward compatibility with config.ts
export const ANDROPROJECT_BIN = discoverAndroprojectBin();
export const SCRCPY_SERVER_PATH = discoverScrcpyServer();
