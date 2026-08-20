/**
 * Screen Capture — Captures device screenshots.
 * SOLID: SRP (only captures screenshots), DIP (depends on IAdbExecutor).
 */
import { IAdbExecutor } from './adb-executor';

export interface CaptureResult {
  ok: boolean;
  data: Uint8Array | null;
  error?: string;
}

export interface IScreenCapture {
  /** Capture a screenshot from the device. Returns PNG bytes. */
  capture(serial: string): Promise<CaptureResult>;
}

export class ScreenCapture implements IScreenCapture {
  constructor(private adb: IAdbExecutor) {}

  async capture(serial: string): Promise<CaptureResult> {
    // Method 1: exec-out pipes PNG directly (fastest)
    const r1 = await this.captureExecOut(serial);
    if (r1.ok) return r1;

    // Method 2: file-based via /sdcard
    const r2 = await this.captureViaFile(serial, '/sdcard');
    if (r2.ok) return r2;

    // Method 3: file-based via /data/local/tmp
    const r3 = await this.captureViaFile(serial, '/data/local/tmp');
    if (r3.ok) return r3;

    return {
      ok: false,
      data: null,
      error: `All capture methods failed: ${r1.error} | ${r2.error} | ${r3.error}`,
    };
  }

  private async captureExecOut(serial: string): Promise<CaptureResult> {
    const result = await this.adb.execOut(serial, 'exec-out screencap -p', 15000);
    if (!result.ok) return { ok: false, data: null, error: result.err };

    const buf = result.stdout;
    if (buf.length > 1000 && buf[0] === 0x89 && buf[1] === 0x50) {
      return { ok: true, data: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) };
    }
    return { ok: false, data: null, error: 'Invalid PNG data' };
  }

  private async captureViaFile(serial: string, dir: string): Promise<CaptureResult> {
    const timestamp = Date.now();
    const devicePath = `${dir}/screenshot_${timestamp}.png`;

    // Capture on device
    const r1 = await this.adb.execFor(serial, `shell screencap -p "${devicePath}"`, 15000);
    if (!r1.ok) return { ok: false, data: null, error: r1.err };

    // Pull to PC (using stdout pipe)
    const r2 = await this.adb.execOut(serial, `exec-out cat "${devicePath}"`, 15000);
    // Clean up device file
    await this.adb.execFor(serial, `shell rm -f "${devicePath}"`, 3000);

    if (!r2.ok) return { ok: false, data: null, error: r2.err };

    const buf = r2.stdout;
    if (buf.length > 1000 && buf[0] === 0x89 && buf[1] === 0x50) {
      return { ok: true, data: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) };
    }
    return { ok: false, data: null, error: 'Invalid PNG from file method' };
  }
}
