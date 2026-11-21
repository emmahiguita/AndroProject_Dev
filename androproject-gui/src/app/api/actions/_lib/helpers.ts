import { exec } from 'child_process';
import { promisify } from 'util';

const execAsyncOrig = promisify(exec);
const execAsync = async (command: string, options: { timeout?: number; encoding?: BufferEncoding; maxBuffer?: number } = {}) => {
  return execAsyncOrig(command, { encoding: 'utf8', ...options, windowsHide: true });
};

/** Human-readable error from unknown exception */
export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Execute a shell command with timeout. Returns { ok, out, err } never throws. */
export async function safeExec(cmd: string, timeoutMs: number = 10000): Promise<{ ok: boolean; out: string; err: string }> {
  try {
    const result = await execAsync(cmd, { timeout: timeoutMs, encoding: 'utf8' });
    const stdout = typeof result.stdout === 'string' ? result.stdout : (result.stdout ? String(result.stdout) : '');
    const stderr = typeof result.stderr === 'string' ? result.stderr : (result.stderr ? String(result.stderr) : '');
    return { ok: true, out: stdout, err: stderr };
  } catch (error: unknown) {
    const failure = error as { stdout?: unknown };
    const output = typeof failure.stdout === 'string' ? failure.stdout : '';
    return { ok: false, out: output, err: getErrorMessage(error) };
  }
}

export { execAsync };
