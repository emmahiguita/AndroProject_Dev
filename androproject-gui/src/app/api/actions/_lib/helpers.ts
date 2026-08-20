import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** Human-readable error from unknown exception */
export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Execute a shell command with timeout. Returns { ok, out, err } never throws. */
export async function safeExec(cmd: string, timeoutMs: number = 10000) {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs });
    return { ok: true, out: stdout, err: stderr } as const;
  } catch (error: unknown) {
    const failure = error as { stdout?: unknown };
    const output = typeof failure.stdout === 'string' ? failure.stdout : '';
    return { ok: false, out: output, err: getErrorMessage(error) } as const;
  }
}

export { execAsync };
