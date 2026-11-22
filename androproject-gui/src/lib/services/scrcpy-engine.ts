// ============================================================================
// ARCHIVO: scrcpy-engine.ts
// QUÉ HACE: Gestiona el ciclo de vida de procesos nativos VisionNano (scrcpy)
//           con renderizado GPU Direct3D11, locks por serial y limpieza.
// CÓMO FUNCIONA: Delega la construcción de flags a `buildVisionNanoArgs`, lanza
//           scrcpy desacoplado con archivo lock por dispositivo/display y
//           permite verificar o detener sesiones sin dejar procesos zombis.
// POR QUÉ: Centralizar el ciclo de vida garantiza idempotencia al iniciar y
//           terminación determinista de árboles de procesos en Windows.
// ============================================================================

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  ANDROPROJECT_BIN, ADB,
  getLockFile, writeLock, readLock, isLockAlive, killLockedProcess,
} from '@/lib/config';
import {
  buildVisionNanoArgs,
  type VisionNanoOptions,
  type ScrcpyEngineOptions,
  type VisionNanoResult,
  type ScrcpyStreamResult,
  type IVisionNanoEngine,
  type IScrcpyEngine,
} from './scrcpy-args';

export type {
  VisionNanoOptions,
  ScrcpyEngineOptions,
  VisionNanoResult,
  ScrcpyStreamResult,
  IVisionNanoEngine,
  IScrcpyEngine,
};

export class VisionNanoEngine implements IVisionNanoEngine {
  private static activePids = new Map<string, number>();

  /** Expone el constructor de argumentos CLI para mantener compatibilidad DIP. */
  public buildArgs(options: VisionNanoOptions): string[] {
    return buildVisionNanoArgs(options);
  }

  /**
   * Inicia la transmisión nativa VisionNano 60 FPS para el dispositivo indicado.
   * Es idempotente: si el lock sigue vivo, devuelve el PID activo sin reiniciar.
   */
  public async start(options: VisionNanoOptions): Promise<VisionNanoResult> {
    const { serial } = options;
    if (!serial) {
      return { success: false, alive: false, error: 'Dispositivo no especificado' };
    }

    if (ANDROPROJECT_BIN !== 'scrcpy' && !fs.existsSync(ANDROPROJECT_BIN)) {
      return { success: false, alive: false, error: `Binario VisionNano no encontrado en ${ANDROPROJECT_BIN}` };
    }

    const lockFile = getLockFile(serial, options.displayId, options.videoSource);

    if (await isLockAlive(lockFile)) {
      const lockData = readLock(lockFile);
      return {
        success: true,
        alive: true,
        pid: typeof lockData?.pid === 'number' ? lockData.pid : undefined,
        message: 'VisionNano ya se encuentra transmitiendo para este dispositivo',
      };
    }

    await killLockedProcess(lockFile);

    const args = this.buildArgs(options);
    const scrcpyDir = path.dirname(ANDROPROJECT_BIN);
    const adbDir = path.dirname(ADB);
    const envPath = `${scrcpyDir};${adbDir};${process.env.PATH || ''}`;

    const child = spawn(ANDROPROJECT_BIN, args, {
      cwd: scrcpyDir,
      env: { ...process.env, PATH: envPath, ADB },
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });

    if (!child.pid) {
      return { success: false, alive: false, error: 'No se pudo generar el proceso VisionNano' };
    }

    writeLock(lockFile, {
      pid: child.pid,
      serial,
      processName: path.basename(ANDROPROJECT_BIN),
      owner: 'vision-nano',
    });
    VisionNanoEngine.activePids.set(lockFile, child.pid);
    child.unref();

    return {
      success: true,
      alive: true,
      pid: child.pid,
      message: options.videoSource === 'camera'
        ? 'VisionNano Cámara transmitiendo a 60 FPS'
        : 'VisionNano transmitiendo a 60 FPS (Latencia Cero - Direct3D11 GPU)',
    };
  }

  /** Detiene limpiamente el proceso VisionNano asociado al serial/display. */
  public async stop(serial: string, displayId: number | string = 0, source: string = 'display'): Promise<boolean> {
    const lockFile = getLockFile(serial, displayId, source);
    VisionNanoEngine.activePids.delete(lockFile);
    return await killLockedProcess(lockFile);
  }

  /** Verifica si el proceso VisionNano sigue vivo mediante su archivo lock. */
  public async checkAlive(serial: string, displayId: number | string = 0, source: string = 'display'): Promise<boolean> {
    const lockFile = getLockFile(serial, displayId, source);
    return await isLockAlive(lockFile);
  }

  /** Detiene todas las sesiones activas registradas por VisionNano. */
  public static async stopAll(): Promise<void> {
    const lockFiles = Array.from(VisionNanoEngine.activePids.keys());
    VisionNanoEngine.activePids.clear();
    await Promise.all(lockFiles.map((lockFile) => killLockedProcess(lockFile)));
  }
}

export const visionNanoEngine = new VisionNanoEngine();
export const scrcpyEngine = visionNanoEngine;
export const ScrcpyEngine = VisionNanoEngine;
