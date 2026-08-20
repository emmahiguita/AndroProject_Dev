/**
 * Action context builder.
 * SOLID: SRP (only builds context), DIP (uses IAdbExecutor).
 * Improvement: Uses serial from request body directly, no extra ADB call.
 */
import { ADB, FASTBOOT } from '@/lib/config';

export interface ActionContext {
  targetSerial: string | undefined;
  adbTarget: string;
  fastbootTarget: string;
}

/**
 * Build ActionContext from request body.
 * Uses the serial provided in the body — no extra `adb devices` call.
 * Falls back to first connected device only if no serial is provided.
 */
export async function buildContext(body: { serial?: string; ip?: string }): Promise<ActionContext> {
  let serial = body.serial || body.ip;

  // Fallback: only if no serial provided, query ADB for first device
  if (!serial) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    try {
      const { stdout } = await execAsync(`"${ADB}" devices`, { timeout: 3000 });
      serial = stdout.split('\n').slice(1).find((l: string) => l.includes('\tdevice'))?.split(/\s+/)[0];
    } catch {}
  }

  const adbTarget = serial ? `"${ADB}" -s ${serial}` : `"${ADB}"`;
  const fastbootTarget = serial && serial !== 'Hardware Level'
    ? `"${FASTBOOT}" -s ${serial}`
    : `"${FASTBOOT}"`;

  return { targetSerial: serial, adbTarget, fastbootTarget };
}
