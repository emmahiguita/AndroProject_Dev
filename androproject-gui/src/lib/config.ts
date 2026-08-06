/**
 * Configuración centralizada del sistema AndroProject.
 * Las rutas se leen de variables de entorno con fallbacks.
 * Para desarrollo local, crear un .env.local con los valores correctos.
 */
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ═══════════════════════════════════════════════════════════════════════════
// Rutas base — prioridad: env var → fallback automático → fallback duro
// ═══════════════════════════════════════════════════════════════════════════

function findFirstExisting(...candidates: string[]): string {
  for (const p of candidates) {
    if (fs.existsSync(/* turbopackIgnore: true */ p)) return p;
  }
  return candidates[candidates.length - 1]; // devolver el último como intento
}

function findWingetScrcpy(): string {
  const packagesRoot = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  try {
    for (const packageName of fs.readdirSync(/* turbopackIgnore: true */ packagesRoot)) {
      if (!packageName.startsWith('Genymobile.scrcpy_')) continue;
      const packageRoot = path.join(/* turbopackIgnore: true */ packagesRoot, packageName);
      for (const releaseName of fs.readdirSync(/* turbopackIgnore: true */ packageRoot)) {
        const candidate = path.join(/* turbopackIgnore: true */ packageRoot, releaseName, 'scrcpy.exe');
        if (fs.existsSync(/* turbopackIgnore: true */ candidate)) return candidate;
      }
    }
  } catch {}
  return path.join(packagesRoot, 'scrcpy.exe');
}


// ── Directorio raíz de AndroProject ────────────────────────────────────
export const ANDROPROJECT_HOME =
  process.env.ANDROPROJECT_HOME || 'C:\\AndroProject';

// ── ADB ─────────────────────────────────────────────────────────────────
const ADB_ENV = process.env.ANDROPROJECT_ADB_PATH;
const ADB_BUNDLED = path.join(ANDROPROJECT_HOME, 'adb.exe');
const ADB_SDK = path.join(
  process.env.ANDROID_SDK_ROOT || process.env.LOCALAPPDATA || '',
  'Android', 'Sdk', 'platform-tools', 'adb.exe'
);
const ADB_SDK_ALT = path.join(
  process.env.USERPROFILE || '',
  'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'
);

export const ADB = ADB_ENV
  ? (fs.existsSync(ADB_ENV) ? ADB_ENV : 'adb')
  : findFirstExisting(ADB_BUNDLED, ADB_SDK, ADB_SDK_ALT, 'adb');

// ── AndroProject.exe (scrcpy renombrado) ────────────────────────────────
const SCRCPY_WINGET = findWingetScrcpy();
const SCRCPY_USER = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'scrcpy', 'scrcpy.exe');
export const ANDROPROJECT_BIN = process.env.ANDROPROJECT_BIN_PATH
  ? findFirstExisting(process.env.ANDROPROJECT_BIN_PATH, SCRCPY_WINGET, 'scrcpy')
  : findFirstExisting(
      path.join(ANDROPROJECT_HOME, 'AndroProject.exe'),
      path.join(ANDROPROJECT_HOME, 'scrcpy.exe'),
      SCRCPY_WINGET,
      SCRCPY_USER,
      'scrcpy'
    );

// ── Fastboot ────────────────────────────────────────────────────────────
const FASTBOOT_ENV = process.env.ANDROPROJECT_FASTBOOT_PATH;
const FASTBOOT_BUNDLED = path.join(ANDROPROJECT_HOME, 'fastboot.exe');
const FASTBOOT_SDK = path.join(
  process.env.ANDROID_SDK_ROOT || process.env.LOCALAPPDATA || '',
  'Android', 'Sdk', 'platform-tools', 'fastboot.exe'
);
const FASTBOOT_SDK_ALT = path.join(
  process.env.USERPROFILE || '',
  'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'fastboot.exe'
);

export const FASTBOOT = FASTBOOT_ENV
  ? (fs.existsSync(FASTBOOT_ENV) ? FASTBOOT_ENV : 'fastboot')
  : findFirstExisting(FASTBOOT_BUNDLED, FASTBOOT_SDK, FASTBOOT_SDK_ALT, 'fastboot');

// ── Capturas (screenshots y grabaciones) ────────────────────────────────
export const SCREENSHOTS_DIR =
  process.env.ANDROPROJECT_CAPTURES_DIR ||
  path.join(ANDROPROJECT_HOME, 'Capturas');

// ── Archivos de lock para procesos ──────────────────────────────────────
export const getLockFile = (serial: string): string =>
  path.join(ANDROPROJECT_HOME, `.androproject_active_${serial.replace(/[:.]/g, '_')}`);

export const getRecordLockFile = (serial: string): string =>
  path.join(ANDROPROJECT_HOME, `.androproject_record_${serial.replace(/[:.]/g, '_')}`);

export async function cleanupOrphanedLocks() {
  if (!fs.existsSync(ANDROPROJECT_HOME)) return;
  const files = fs.readdirSync(ANDROPROJECT_HOME);
  for (const file of files) {
    if (file.startsWith('.androproject_active_') || file.startsWith('.androproject_record_')) {
      const lockPath = path.join(ANDROPROJECT_HOME, file);
      try {
        const raw = fs.readFileSync(lockPath, 'utf8').trim();
        let pid: number | null = null;
        if (file.startsWith('.androproject_record_')) {
          if (raw.startsWith('{')) {
            pid = JSON.parse(raw).pid;
          } else {
            pid = parseInt(raw, 10);
          }
        }
        
        if (pid) {
          const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /NH`);
          if (!stdout.includes('AndroProject')) fs.unlinkSync(lockPath);
        } else if (file.startsWith('.androproject_active_')) {
          const { stdout } = await execAsync(`wmic process where "name='AndroProject.exe'" get commandline`);
          const serialMatch = file.match(/\.androproject_active_(.+)/);
          if (serialMatch && !stdout.includes(serialMatch[1])) {
            fs.unlinkSync(lockPath);
          }
        }
      } catch {}
    }
  }
}

// ── Debug log ───────────────────────────────────────────────────────────
export const DEBUG_LOG = path.join(ANDROPROJECT_HOME, 'scrcpy_debug.log');

// ── Servidor ────────────────────────────────────────────────────────────
export const SCRCPY_SERVER_PATH =
  process.env.ANDROPROJECT_SERVER_PATH || 'AndroProject-server';

export const SCRCPY_ICON_PATH =
  process.env.ANDROPROJECT_ICON_PATH || 'AndroProject.png';

// ── Log de inicialización (solo en servidor) ───────────────────────────
if (typeof window === 'undefined') {
  // Solo se ejecuta en API routes / server-side
  console.log(`[Config] AndroProject Home: ${ANDROPROJECT_HOME}`);
  console.log(`[Config] ADB: ${ADB}`);
  console.log(`[Config] Binary: ${ANDROPROJECT_BIN}`);
}
