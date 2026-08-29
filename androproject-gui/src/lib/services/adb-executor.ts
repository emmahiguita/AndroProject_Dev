/**
 * ADB Executor — Interface + Implementation.
 * SOLID: DIP (depend on abstraction, not concretions).
 * SRP: Only executes ADB commands, nothing else.
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';

const execAsync = promisify(exec);

export interface AdbExecResult {
  readonly ok: boolean;
  readonly out: string;
  readonly err: string;
}

export interface IAdbExecutor {
  /** Path to the ADB binary */
  readonly adbPath: string;
  /** Execute an ADB command with timeout. Never throws. */
  exec(args: string, timeoutMs?: number): Promise<AdbExecResult>;
  /** Execute an ADB command against a specific device */
  execFor(serial?: string, args?: string, timeoutMs?: number): Promise<AdbExecResult>;
  /** Execute a shell command on the device */
  shell(serial?: string, cmd?: string, timeoutMs?: number): Promise<AdbExecResult>;
  /** Execute exec-out (for binary data like screencap) */
  execOut(serial?: string, args?: string, timeoutMs?: number): Promise<{ ok: boolean; stdout: Buffer; err: string }>;
}

export class AdbExecutor implements IAdbExecutor {
  readonly adbPath = ADB;

  async exec(args: string, timeoutMs: number = 10000): Promise<AdbExecResult> {
    try {
      const { stdout, stderr } = await execAsync(`"${this.adbPath}" ${args}`, { timeout: timeoutMs });
      return { ok: true, out: stdout, err: stderr };
    } catch (error: unknown) {
      const failure = error as { stdout?: unknown };
      const output = typeof failure.stdout === 'string' ? failure.stdout : '';
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, out: output, err: message };
    }
  }

  async execFor(serial?: string, args: string = '', timeoutMs: number = 10000): Promise<AdbExecResult> {
    const prefix = (serial && serial !== 'undefined' && serial !== 'default') ? `-s ${serial} ` : '';
    return this.exec(`${prefix}${args}`, timeoutMs);
  }

  async shell(serial?: string, cmd: string = '', timeoutMs: number = 15000): Promise<AdbExecResult> {
    const safeCmd = cmd.replace(/"/g, '\\"');
    const prefix = (serial && serial !== 'undefined' && serial !== 'default') ? `-s ${serial} ` : '';
    return this.exec(`${prefix}shell "${safeCmd}"`, timeoutMs);
  }

  async execOut(serial?: string, args: string = '', timeoutMs: number = 20000): Promise<{ ok: boolean; stdout: Buffer; err: string }> {
    const prefix = (serial && serial !== 'undefined' && serial !== 'default') ? `-s ${serial} ` : '';
    try {
      const { stdout } = await execAsync(`"${this.adbPath}" ${prefix}${args}`, {
        timeout: timeoutMs,
        encoding: 'buffer',
        maxBuffer: 20 * 1024 * 1024,
      }) as { stdout: Buffer };
      return { ok: true, stdout, err: '' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, stdout: Buffer.alloc(0), err: message };
    }
  }
}

/** Singleton instance for production use */
export const adb = new AdbExecutor();
