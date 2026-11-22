/**
 * Action context builder.
 * SOLID: SRP (only builds context), DIP (uses IAdbExecutor).
 * Improvement: Uses serial from request body directly, no extra ADB call.
 */
import { ADB, FASTBOOT } from '@/lib/config';
import { adb } from '@/lib/services/adb-executor';

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
    const devices = await adb.exec(['devices'], 3000);
    if (devices.ok) {
      serial = devices.out.split('\n').slice(1).find((line) => line.includes('\tdevice'))?.split(/\s+/)[0];
    }
  }

  const adbTarget = serial ? `"${ADB}" -s ${serial}` : `"${ADB}"`;
  const fastbootTarget = serial && serial !== 'Hardware Level'
    ? `"${FASTBOOT}" -s ${serial}`
    : `"${FASTBOOT}"`;

  return { targetSerial: serial, adbTarget, fastbootTarget };
}
