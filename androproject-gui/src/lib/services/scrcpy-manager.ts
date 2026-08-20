/**
 * Scrcpy Manager — Manages scrcpy process lifecycle.
 * SOLID: SRP (only manages scrcpy), DIP (depends on IAdbExecutor).
 */
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { IAdbExecutor } from './adb-executor';

export interface ScrcpyInstance {
  pid: number;
  serial: string;
  process: ChildProcess;
}

export interface IScrcpyManager {
  /** Find scrcpy binary path */
  findBinary(): string;
  /** Start a scrcpy instance for a device */
  start(serial: string, options?: ScrcpyOptions): Promise<ScrcpyInstance | null>;
  /** Stop a running scrcpy instance */
  stop(instance: ScrcpyInstance): Promise<void>;
  /** Check if a scrcpy process is still alive */
  isAlive(pid: number): boolean;
}

export interface ScrcpyOptions {
  window?: boolean;
  audio?: boolean;
  videoBitRate?: string;
  maxSize?: number;
  maxFps?: number;
  stayAwake?: boolean;
  record?: string;
  videoSource?: 'display' | 'camera';
}

function findScrcpyBinary(): string {
  const wingetPkgs = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  const candidates: string[] = [];

  try {
    for (const pkg of fs.readdirSync(wingetPkgs)) {
      if (!pkg.startsWith('Genymobile.scrcpy')) continue;
      const pkgDir = path.join(wingetPkgs, pkg);
      try {
        for (const release of fs.readdirSync(pkgDir)) {
          const exe = path.join(pkgDir, release, 'scrcpy.exe');
          if (fs.existsSync(exe)) candidates.push(exe);
        }
      } catch {}
    }
  } catch {}

  if (process.env.ANDROPROJECT_BIN_PATH) candidates.push(process.env.ANDROPROJECT_BIN_PATH);
  candidates.push('C:\\Program Files\\scrcpy\\scrcpy.exe', 'scrcpy');

  return candidates.find(c => {
    try { return !!c && fs.existsSync(c); } catch { return false; }
  }) || 'scrcpy';
}

export class ScrcpyManager implements IScrcpyManager {
  private binaryPath: string | null = null;

  constructor(private adb: IAdbExecutor) {}

  findBinary(): string {
    if (!this.binaryPath) this.binaryPath = findScrcpyBinary();
    return this.binaryPath;
  }

  async start(serial: string, options: ScrcpyOptions = {}): Promise<ScrcpyInstance | null> {
    const bin = this.findBinary();
    const adbPath = this.adb.adbPath;

    const args: string[] = [
      '-s', serial,
      '--video-codec=h264',
      '--max-size=720',
      '--max-fps=30',
      '--video-bit-rate=8M',
    ];

    if (options.window !== false) {
      args.push('--window-title', `AndroProject - ${serial}`);
    } else {
      args.push('--no-window');
    }
    if (options.audio === false) args.push('--no-audio');
    if (options.stayAwake !== false) args.push('--stay-awake');
    if (options.record) args.push('--record', options.record, '--record-format=mkv');
    if (options.videoSource === 'camera') args.push('--video-source=camera', '--no-audio');

    return new Promise((resolve) => {
      const proc = spawn(bin, args, {
        env: { ...process.env, ADB: adbPath },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      if (!proc.pid) {
        resolve(null);
        return;
      }

      // Log stderr for debugging
      proc.stderr?.on('data', (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) console.log(`[scrcpy] ${msg}`);
      });

      // Wait a moment to check if process starts successfully
      setTimeout(() => {
        if (proc.exitCode !== null && proc.exitCode !== undefined) {
          resolve(null);
          return;
        }
        resolve({ pid: proc.pid!, serial, process: proc });
      }, 500);
    });
  }

  async stop(instance: ScrcpyInstance): Promise<void> {
    try { instance.process.kill('SIGTERM'); } catch {}
    setTimeout(() => {
      try { instance.process.kill('SIGKILL'); } catch {}
    }, 2000);
  }

  isAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}
