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

import { spawn, type ChildProcess } from 'child_process';
import { Socket } from 'net';
import fs from 'fs';
import path from 'path';
import {
  ANDROPROJECT_BIN, ANDROPROJECT_HOME, ADB,
  getLockFile, writeLock, readLock, deleteLock, isLockAlive, killLockedProcess,
} from '@/lib/config';
import { isValidDeviceSerial } from '@/lib/security/input-sanitizer';
import { adb } from './adb-executor';
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
  private static activeChildren = new Map<string, ChildProcess>();
  private readonly starting = new Map<string, { serial: string; result: Promise<VisionNanoResult> }>();

  /** Expone el constructor de argumentos CLI para mantener compatibilidad DIP. */
  public buildArgs(options: VisionNanoOptions): string[] {
    return buildVisionNanoArgs(options);
  }

  /**
   * Inicia la transmisión nativa VisionNano 60 FPS para el dispositivo indicado.
   * Es idempotente: si el lock sigue vivo, devuelve el PID activo sin reiniciar.
   */
  public async start(options: VisionNanoOptions): Promise<VisionNanoResult> {
    if (!isValidDeviceSerial(options.serial)) {
      return { success: false, alive: false, error: 'Selecciona un Android conectado y autorizado por ADB.' };
    }
    const displayId = Number(options.displayId ?? 0);
    const normalized = {
      ...options,
      serial: options.serial.trim(),
      displayId: Number.isSafeInteger(displayId) && displayId >= 0 ? displayId : 0,
    };
    const lockFile = getLockFile(normalized.serial, normalized.displayId, normalized.videoSource);
    const pending = this.starting.get(lockFile);
    if (pending) return pending.result;

    const result = this.startSession(normalized, lockFile);
    this.starting.set(lockFile, { serial: normalized.serial, result });
    try {
      return await result;
    } finally {
      this.starting.delete(lockFile);
    }
  }

  private async startSession(options: VisionNanoOptions, lockFile: string): Promise<VisionNanoResult> {
    const { serial } = options;
    if (ANDROPROJECT_BIN !== 'scrcpy' && !fs.existsSync(ANDROPROJECT_BIN)) {
      return { success: false, alive: false, error: `Binario VisionNano no encontrado en ${ANDROPROJECT_BIN}` };
    }

    if (await VisionNanoEngine.sessionAlive(lockFile)) {
      const lockData = readLock(lockFile);
      return {
        success: true,
        alive: true,
        pid: typeof lockData?.pid === 'number' ? lockData.pid : undefined,
        message: 'VisionNano ya se encuentra transmitiendo para este dispositivo',
      };
    }

    const state = await adb.execFor(serial, ['get-state'], 3000);
    if (!state.ok || state.out.trim() !== 'device') {
      return { success: false, alive: false, error: 'ADB no detecta ese Android como conectado y autorizado. Revisa el cable o la conexión Wi-Fi.' };
    }
    deleteLock(lockFile);

    const args = this.buildArgs(options);
    const scrcpyDir = path.dirname(ANDROPROJECT_BIN);
    const adbDir = path.dirname(ADB);
    const envPath = `${scrcpyDir};${adbDir};${process.env.PATH || ''}`;

    const child = spawn(ANDROPROJECT_BIN, args, {
      cwd: scrcpyDir,
      env: { ...process.env, PATH: envPath, ADB },
      detached: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });

    child.unref();
    if (child.stderr instanceof Socket) child.stderr.unref();
    let diagnostic = '';
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
      diagnostic = (diagnostic + chunk).slice(-4096);
    });

    return new Promise((resolve) => {
      const ended = (error: string) => {
        clearTimeout(startup);
        if (VisionNanoEngine.activeChildren.get(lockFile) === child) VisionNanoEngine.activeChildren.delete(lockFile);
        if (child.pid && readLock(lockFile)?.pid === child.pid) deleteLock(lockFile);
        resolve({ success: false, alive: false, error });
      };
      const startup = setTimeout(() => {
        if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
          ended(diagnostic.trim() || 'scrcpy se cerró antes de abrir la pantalla.');
          return;
        }
        const binaryName = path.basename(ANDROPROJECT_BIN);
        const processName = binaryName === 'scrcpy' && process.platform === 'win32' ? 'scrcpy.exe' : binaryName;
        try {
          writeLock(lockFile, { pid: child.pid, serial, processName, owner: 'vision-nano' });
        } catch {
          child.kill();
          ended('No se pudo registrar la sesión de pantalla en la carpeta de ANDRO-IOS.');
          return;
        }
        VisionNanoEngine.activeChildren.set(lockFile, child);
        resolve({ success: true, alive: true, pid: child.pid, message: 'Sesión de proyección iniciada.' });
      }, 1500);
      child.once('error', (error) => ended(error.message));
      child.once('close', () => ended(diagnostic.trim() || 'scrcpy se cerró.'));
    });
  }

  /** Detiene limpiamente el proceso VisionNano asociado al serial/display. */
  public async stop(serial: string, displayId?: number | string, source?: string): Promise<boolean> {
    if (!isValidDeviceSerial(serial)) return false;
    serial = serial.trim();
    const selected = displayId !== undefined || source !== undefined ? getLockFile(serial, displayId, source) : undefined;
    await Promise.allSettled([...this.starting]
      .filter(([file, pending]) => pending.serial === serial && (!selected || file === selected))
      .map(([, pending]) => pending.result));
    return (await Promise.all((selected ? [selected] : this.deviceLocks(serial)).map((file) => VisionNanoEngine.stopSession(file)))).some(Boolean);
  }

  /** Verifica si el proceso VisionNano sigue vivo mediante su archivo lock. */
  public async checkAlive(serial: string, displayId?: number | string, source?: string): Promise<boolean> {
    if (!isValidDeviceSerial(serial)) return false;
    serial = serial.trim();
    const files = displayId !== undefined || source !== undefined ? [getLockFile(serial, displayId, source)] : this.deviceLocks(serial);
    return (await Promise.all(files.map((file) => VisionNanoEngine.sessionAlive(file)))).some(Boolean);
  }

  private deviceLocks(serial: string): string[] {
    if (!fs.existsSync(ANDROPROJECT_HOME)) return [];
    const base = path.basename(getLockFile(serial));
    return fs.readdirSync(ANDROPROJECT_HOME)
      .filter((entry) => entry === base || entry.startsWith(`${base}_d`))
      .map((entry) => path.join(ANDROPROJECT_HOME, entry))
      .filter((file) => {
        const lock = readLock(file);
        return lock?.serial === serial || (path.basename(file) === base && lock?.serial === undefined);
      });
  }

  private static async sessionAlive(file: string): Promise<boolean> {
    const child = VisionNanoEngine.activeChildren.get(file);
    return child ? child.exitCode === null && child.signalCode === null : isLockAlive(file);
  }

  private static async stopSession(file: string): Promise<boolean> {
    const child = VisionNanoEngine.activeChildren.get(file);
    if (!child) return killLockedProcess(file);
    if (child.exitCode !== null || child.signalCode !== null) return false;

    return new Promise((resolve) => {
      const onExit = () => finish(true);
      const finish = (stopped: boolean) => {
        clearTimeout(deadline);
        child.removeListener('exit', onExit);
        resolve(stopped);
      };
      const deadline = setTimeout(() => finish(false), 2000);
      child.once('exit', onExit);
      try {
        if (!child.kill()) finish(false);
      } catch {
        finish(false);
      }
    });
  }

  /** Detiene todas las sesiones activas registradas por VisionNano. */
  public static async stopAll(): Promise<void> {
    const lockFiles = Array.from(VisionNanoEngine.activeChildren.keys());
    await Promise.all(lockFiles.map((lockFile) => VisionNanoEngine.stopSession(lockFile)));
  }
}

export const visionNanoEngine = new VisionNanoEngine();
export const scrcpyEngine = visionNanoEngine;
export const ScrcpyEngine = VisionNanoEngine;
