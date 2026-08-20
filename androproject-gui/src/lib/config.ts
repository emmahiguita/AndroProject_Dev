/**
 * Configuración centralizada del sistema AndroProject.
 * Re-exporta desde módulos especializados (SOLID: Single Responsibility).
 *
 * Módulos:
 *   paths.ts      — resolución de rutas de herramientas (ADB, fastboot, capturas)
 *   discovery.ts  — descubrimiento de binarios (scrcpy via WinGet, env, PATH)
 *   locks.ts      — gestión de archivos de lock para procesos concurrentes
 */
export {
  ADB, FASTBOOT, ANDROPROJECT_HOME, SCREENSHOTS_DIR, DEBUG_LOG,
} from './paths';

export {
  ANDROPROJECT_BIN,
} from './discovery';

export {
  getLockFile, getRecordLockFile,
  writeLock, readLock, deleteLock,
  isLockAlive, killLockedProcess,
  cleanupOrphanedLocks,
} from './locks';

// ── Constantes simples (solo env vars, no lógica) ────────────────
export const SCRCPY_SERVER_PATH =
  process.env.ANDROPROJECT_SERVER_PATH || 'AndroProject-server';

export const SCRCPY_ICON_PATH =
  process.env.ANDROPROJECT_ICON_PATH || 'AndroProject.png';

// ── Log de inicialización (solo en servidor) ────────────────────
import { ANDROPROJECT_HOME as _HOME, ADB as _ADB } from './paths';
import { ANDROPROJECT_BIN as _BIN } from './discovery';

if (typeof window === 'undefined') {
  console.log(`[Config] AndroProject Home: ${_HOME}`);
  console.log(`[Config] ADB: ${_ADB}`);
  console.log(`[Config] Binary: ${_BIN}`);
}
