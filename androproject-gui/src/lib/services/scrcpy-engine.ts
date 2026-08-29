/**
 * ScrcpyEngine — High-performance zero-latency hardware streaming service.
 * 
 * Enforces zero-latency video flags:
 *   - Direct3D11 GPU rendering (--render-driver=direct3d11)
 *   - Zero video buffering (--video-buffer=0)
 *   - Hardware H.264 video decoding with zero audio resync stalls (--no-audio)
 *   - Anti-bufferbloat adaptive bitrates (8M for Wi-Fi, 16M for USB)
 */
import { spawn } from 'child_process';
import fs from 'fs';
import {
  ANDROPROJECT_BIN, ANDROPROJECT_HOME, ADB,
  getLockFile, writeLock, deleteLock, isLockAlive, killLockedProcess,
} from '@/lib/config';

export interface ScrcpyEngineOptions {
  serial: string;
  displayId?: number | string;
  maxSize?: number | string;
  maxFps?: number | string;
  bitRate?: string;
  videoCodec?: 'h264' | 'h265' | 'av1';
  turnScreenOff?: boolean;
  stayAwake?: boolean;
  alwaysOnTop?: boolean;
  videoSource?: 'display' | 'camera';
  videoBuffer?: number | string;
  noAudio?: boolean;
}

export interface ScrcpyStreamResult {
  success: boolean;
  alive: boolean;
  pid?: number;
  message?: string;
  error?: string;
}

export interface IScrcpyEngine {
  buildArgs(options: ScrcpyEngineOptions): string[];
  start(options: ScrcpyEngineOptions): Promise<ScrcpyStreamResult>;
  stop(serial: string): Promise<boolean>;
  checkAlive(serial: string): Promise<boolean>;
}

export class ScrcpyEngine implements IScrcpyEngine {
  /**
   * Reverse-engineered scrcpy CLI argument builder with zero-latency Direct3D11 flags.
   */
  public buildArgs(options: ScrcpyEngineOptions): string[] {
    const { serial } = options;
    const isWifi = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(serial);

    const bitRate = options.bitRate ? String(options.bitRate) : (isWifi ? '8M' : '16M');
    const maxSize = options.maxSize && options.maxSize !== '0' ? String(options.maxSize) : '1080';
    const maxFps = options.maxFps ? String(options.maxFps) : '60';
    const videoCodec = options.videoCodec || 'h264';
    const displayId = options.displayId !== undefined ? String(options.displayId) : '0';
    const videoBuffer = options.videoBuffer !== undefined ? String(options.videoBuffer) : (isWifi ? '10' : '0');

    const args: string[] = ['-s', String(serial)];

    if (options.videoSource !== 'camera') {
      args.push(`--display-id=${displayId}`);
    }

    args.push(
      '--video-codec=h264',
      '-b', bitRate,
      '--max-size', '960',
      `--max-fps=${maxFps}`,
      '--video-buffer=0',
      '--render-driver=direct3d11',
      '--window-width=320',
      '--window-height=700',
      '--no-audio',
      `--window-title=Dexterand 60 FPS - ${serial}`,
    );

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
   * Starts native scrcpy 60 FPS zero-latency transmission for a target device.
   */
  public async start(options: ScrcpyEngineOptions): Promise<ScrcpyStreamResult> {
    const { serial } = options;
    if (!serial) {
      return { success: false, alive: false, error: 'Dispositivo no especificado' };
    }

    if (!fs.existsSync(ANDROPROJECT_BIN)) {
      return { success: false, alive: false, error: `Binario scrcpy no encontrado en ${ANDROPROJECT_BIN}` };
    }

    const lockFile = getLockFile(serial);
    deleteLock(lockFile);

    // Clean up any old duplicate scrcpy processes on system
    try {
      const { execSync } = await import('child_process');
      execSync('taskkill /F /IM scrcpy.exe', { stdio: 'ignore' });
    } catch {}

    const args = this.buildArgs(options);

    const child = spawn(ANDROPROJECT_BIN, args, {
      cwd: ANDROPROJECT_HOME,
      env: { ...process.env, ADB },
      windowsHide: false,
    });

    if (!child.pid) {
      return { success: false, alive: false, error: 'No se pudo generar el proceso scrcpy' };
    }

    writeLock(lockFile, { pid: child.pid, serial });

    const cleanup = () => { deleteLock(lockFile); };
    child.once('exit', cleanup);
    child.once('error', cleanup);

    return {
      success: true,
      alive: true,
      pid: child.pid,
      message: options.videoSource === 'camera'
        ? 'Cámara transmitiendo a 60 FPS'
        : 'Proyección transmitiendo a 60 FPS (Latencia Cero - Direct3D11)',
    };
  }

  /**
   * Stops an active scrcpy process cleanly.
   */
  public async stop(serial: string): Promise<boolean> {
    const lockFile = getLockFile(serial);
    return await killLockedProcess(lockFile);
  }

  /**
   * Checks if scrcpy is currently running for a device.
   */
  public async checkAlive(serial: string): Promise<boolean> {
    const lockFile = getLockFile(serial);
    return await isLockAlive(lockFile, 'scrcpy');
  }
}

export const scrcpyEngine = new ScrcpyEngine();
