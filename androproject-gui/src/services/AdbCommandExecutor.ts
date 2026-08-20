import { exec } from 'child_process';
import { promisify } from 'util';
import { ICommandExecutor, CommandResult, AdbConfig } from './types';

const execAsync = promisify(exec);

/** Real ADB command executor — wraps child_process.exec with timeout */
export class AdbCommandExecutor implements ICommandExecutor {
  constructor(private config: AdbConfig) {}

  async exec(cmd: string, timeoutMs: number = 10000): Promise<CommandResult> {
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs });
      return { ok: true, out: stdout, err: stderr };
    } catch (error: unknown) {
      const failure = error as { stdout?: unknown };
      const output = typeof failure.stdout === 'string' ? failure.stdout : '';
      return { ok: false, out: output, err: this.errorMessage(error) };
    }
  }

  /** Build an ADB command targeting the configured device */
  adbCmd(subcommand: string): string {
    const target = this.config.deviceSerial
      ? `-s ${this.config.deviceSerial}`
      : '';
    return `"${this.config.adbPath}" ${target} ${subcommand}`.trim();
  }

  /** Build a Fastboot command targeting the configured device */
  fastbootCmd(subcommand: string): string {
    const target = this.config.deviceSerial && this.config.deviceSerial !== 'Hardware Level'
      ? `-s ${this.config.deviceSerial}`
      : '';
    return `"${this.config.fastbootPath}" ${target} ${subcommand}`.trim();
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Mock executor for testing — returns predefined responses */
export class MockCommandExecutor implements ICommandExecutor {
  private responses: Map<string, CommandResult> = new Map();

  /** Pre-program a response for a command (supports substring matching) */
  mock(cmdSubstring: string, result: CommandResult): void {
    this.responses.set(cmdSubstring, result);
  }

  async exec(cmd: string, _timeoutMs?: number): Promise<CommandResult> {
    // Find the first mock that matches the command
    for (const [key, value] of this.responses.entries()) {
      if (cmd.includes(key)) return value;
    }
    return { ok: true, out: `[mock] ${cmd}`, err: '' };
  }

  clear(): void {
    this.responses.clear();
  }
}
