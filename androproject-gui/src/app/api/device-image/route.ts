/**
 * Device image streaming endpoint — Zero-Lag Force Refresh + ETag Architecture.
 *
 * Performance:
 * - force=true parameter bypasses cache and delivers fresh post-action frame immediately.
 * - Returns 304 Not Modified when frame in memory is unchanged (0 bytes).
 * - Eliminates lag accumulation after user interactions (touch/swipe/keys).
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { adb } from '@/lib/services/adb-executor';
import { airPlayReceiverEngine } from '@/lib/services/airplay-engine';

// ── Persistent last-good frame per serial ───────────────────
const lastGoodFrame = new Map<string, Uint8Array>();
const lastGoodFrameId = new Map<string, number>();
const lastGoodTs = new Map<string, number>();

// ── In-flight capture worker tracker ─────────────────────────
const inFlightWorkers = new Map<string, Promise<Uint8Array | null>>();
let frameSequence = 1;

// ── Placeholder: 1x1 transparent PNG ────────────────────────
function placeholderFrame(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
    0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00,
    0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
    0x60, 0x82,
  ]);
}

/** Trigger background capture */
function triggerCapture(serial: string): Promise<Uint8Array | null> {
  const existing = inFlightWorkers.get(serial);
  if (existing) return existing;

  const worker = (async () => {
    try {
      const res = await adb.execOut(serial, 'exec-out screencap -p', 2000);
      if (res.ok && res.stdout.length > 1000 && res.stdout[0] === 0x89 && res.stdout[1] === 0x50) {
        const frame = new Uint8Array(res.stdout.buffer, res.stdout.byteOffset, res.stdout.byteLength);
        lastGoodFrame.set(serial, frame);
        lastGoodFrameId.set(serial, ++frameSequence);
        lastGoodTs.set(serial, Date.now());
        return frame;
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlightWorkers.delete(serial);
    }
  })();

  inFlightWorkers.set(serial, worker);
  return worker;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serial = searchParams.get('serial');
  const force = searchParams.get('force') === 'true';

  if (!serial) {
    return new NextResponse(placeholderFrame() as unknown as BodyInit, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  }

  // Handle iOS AirPlay screen streaming
  if (serial.startsWith('airplay-')) {
    const frameBuffer = airPlayReceiverEngine.getLatestFrame(serial);
    const uint8 = new Uint8Array(frameBuffer.buffer, frameBuffer.byteOffset, frameBuffer.byteLength);
    return new NextResponse(uint8 as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-store',
        'ETag': String(Date.now()),
        'X-Connection': 'ok',
      },
    });
  }

  // Force fresh post-touch capture
  if (force) {
    inFlightWorkers.delete(serial);
    const fresh = await triggerCapture(serial);
    if (fresh) {
      return new NextResponse(fresh as unknown as BodyInit, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store',
          'ETag': String(lastGoodFrameId.get(serial)),
          'X-Connection': 'ok',
        },
      });
    }
  }

  const existingFrame = lastGoodFrame.get(serial);
  const currentFrameId = lastGoodFrameId.get(serial) || 0;
  const now = Date.now();
  const lastTs = lastGoodTs.get(serial) || 0;

  // Trigger non-blocking capture if idle
  if (!inFlightWorkers.has(serial) && (now - lastTs > 50)) {
    triggerCapture(serial);
  }

  // Check client's If-None-Match header
  const clientFrameId = req.headers.get('If-None-Match');
  if (existingFrame && clientFrameId && clientFrameId === String(currentFrameId)) {
    // 304 Not Modified: 0 bytes transferred
    return new NextResponse(null, {
      status: 304,
      headers: {
        'ETag': String(currentFrameId),
        'Cache-Control': 'no-cache',
        'X-Connection': 'ok',
      },
    });
  }

  // If we have a new frame in memory, return it with ETag
  if (existingFrame) {
    return new NextResponse(existingFrame as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, must-revalidate',
        'ETag': String(currentFrameId),
        'X-Connection': 'ok',
      },
    });
  }

  // First request on startup
  const initialFrame = await triggerCapture(serial);
  if (initialFrame) {
    return new NextResponse(initialFrame as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, must-revalidate',
        'ETag': String(lastGoodFrameId.get(serial) || 1),
        'X-Connection': 'ok',
      },
    });
  }

  // Fallback: If we have ANY previous good frame, return it instead of transparent placeholder
  if (existingFrame) {
    return new NextResponse(existingFrame as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
        'ETag': String(currentFrameId),
        'X-Connection': 'ok',
      },
    });
  }

  return new NextResponse(placeholderFrame() as unknown as BodyInit, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'X-Connection': 'connecting' },
  });
}
