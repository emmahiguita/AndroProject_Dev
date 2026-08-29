/**
 * VisionNanoEngine — High-performance zero-latency hardware streaming service.
 * Clean Architecture & SOLID: SRP, OCP, DIP.
 * 
 * Enforces zero-latency video pipeline:
 *   - Direct3D11 GPU rendering (--render-driver=direct3d11)
 *   - Zero video buffering (--video-buffer=0)
 *   - Hardware H.264 video decoding with zero audio resync stalls (--no-audio)
 *   - Anti-bufferbloat adaptive bitrates (8M for Wi-Fi, 16M for USB)
 *   - Clean process lifecycle with PID locks and orphan garbage collection
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  ANDROPROJECT_BIN, ADB,
  getLockFile, writeLock, isLockAlive, killLockedProcess,
} from '@/lib/config';

export interface VisionNanoOptions {
  serial: string;
  displayId?: number | string;
  maxSize?: number | string;
  maxFps?: number | string;
  bitRate?: string;
  videoCodec?: 'h264' | 'h265' | 'av1';
  turnScreenOff?: boolean;
  stayAwake?: boolean;
  alwaysOnTop?: boolean;
  borderless?: boolean;
  videoSource?: 'display' | 'camera';
  videoBuffer?: number | string;
  noAudio?: boolean;
}

export type ScrcpyEngineOptions = VisionNanoOptions;

export interface VisionNanoResult {
  success: boolean;
  alive: boolean;
  pid?: number;
  message?: string;
  error?: string;
}

export type ScrcpyStreamResult = VisionNanoResult;

export interface IVisionNanoEngine {
  buildArgs(options: VisionNanoOptions): string[];
  start(options: VisionNanoOptions): Promise<VisionNanoResult>;
  stop(serial: string): Promise<boolean>;
  checkAlive(serial: string): Promise<boolean>;
}

export interface IScrcpyEngine extends IVisionNanoEngine {}

export class VisionNanoEngine implements IVisionNanoEngine {
  /**
   * Scrcpy argument builder tailored for VisionNano 60 FPS GPU pipeline.
   */
  public buildArgs(options: VisionNanoOptions): string[] {
    const { serial } = options;
    const isWifi = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(serial);

    const bitRate = options.bitRate ? String(options.bitRate) : (isWifi ? '8M' : '16M');
    const maxSize = options.maxSize && options.maxSize !== '0' ? String(options.maxSize) : '960';
    const maxFps = options.maxFps ? String(options.maxFps) : '60';
    const displayId = options.displayId !== undefined ? String(options.displayId) : '0';

    const args: string[] = ['-s', String(serial)];

    if (options.videoSource !== 'camera') {
      args.push(`--display-id=${displayId}`);
    }

    args.push(
      '--video-codec=h264',
      '-b', bitRate,
      '--max-size', maxSize,
      `--max-fps=${maxFps}`,
      '--video-buffer=0',
      '--render-driver=direct3d11',
      '--window-width=380',
      '--window-height=820',
      '--no-audio',
      `--window-title=AndroProject — Reverse Agent Bridge Monitor`,
    );

    if (options.borderless) {
      args.push('--window-borderless');
    }
    if (options.stayAwake !== false) {
      args.push('--stay-awake');
    }
    if (options.turnScreenOff) {
      args.push('--turn-screen-off');
    }
    if (options.alwaysOnTop) {
      args.push('--always-on-top');
    }
    if (options.videoSource === 'camera') {
      args.push('--video-source=camera', '--camera-facing=back');
    }

    return args;
  }

  /**
   * Starts native VisionNano 60 FPS Direct3D11 GPU transmission for a target device.
   */
  public async start(options: VisionNanoOptions): Promise<VisionNanoResult> {
    const { serial } = options;
    if (!serial) {
      return { success: false, alive: false, error: 'Dispositivo no especificado' };
    }

    if (!fs.existsSync(ANDROPROJECT_BIN)) {
      return { success: false, alive: false, error: `Binario VisionNano no encontrado en ${ANDROPROJECT_BIN}` };
    }

    const lockFile = getLockFile(serial);
    await killLockedProcess(lockFile);

    // Clean up any conflicting MJPEG stream for this serial to free hardware encoder
    try {
      const { StreamManager } = await import('./stream-manager');
      StreamManager.cleanup(serial);
    } catch {}

    const args = this.buildArgs(options);
    const scrcpyDir = path.dirname(ANDROPROJECT_BIN);
    const adbDir = path.dirname(ADB);
    const envPath = `${scrcpyDir};${adbDir};${process.env.PATH || ''}`;

    const child = spawn(ANDROPROJECT_BIN, args, {
      cwd: scrcpyDir,
      env: { ...process.env, PATH: envPath, ADB },
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });

    if (!child.pid) {
      return { success: false, alive: false, error: 'No se pudo generar el proceso VisionNano' };
    }

    writeLock(lockFile, { pid: child.pid, serial });
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

  /**
   * Stops an active VisionNano process cleanly.
   */
  public async stop(serial: string): Promise<boolean> {
    const lockFile = getLockFile(serial);
    return await killLockedProcess(lockFile);
  }

  /**
   * Checks if VisionNano is currently running for a device.
   */
  public async checkAlive(serial: string): Promise<boolean> {
    const lockFile = getLockFile(serial);
    return await isLockAlive(lockFile, 'scrcpy');
  }
}

/** Singleton instance for production use */
export const visionNanoEngine = new VisionNanoEngine();
export const scrcpyEngine = visionNanoEngine;
export const ScrcpyEngine = VisionNanoEngine;

