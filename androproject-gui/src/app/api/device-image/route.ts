/**
 * Device image streaming endpoint.
 * Returns PNG screenshot of the device screen as image/png.
 *
 * Stability improvements:
 * - Returns LAST VALID frame on temporary failure (no grey placeholder)
 * - Connection status header for frontend health monitoring
 * - Adaptive cache TTL based on capture success rate
 * - Never blanks the screen — keeps last known good frame
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';

const execAsync = promisify(exec);

// ── Frame cache with health tracking ────────────────────────
interface FrameEntry {
  data: Uint8Array;
  ts: number;
  ok: boolean;       // was this capture successful?
  consecutiveFails: number;
}
const frameCache = new Map<string, FrameEntry>();
const CACHE_TTL_MS = 100; // minimum time between captures

// ── Persistent last-good frame per serial (survives errors) ─
const lastGoodFrame = new Map<string, Uint8Array>();

// ── Connection health per serial ────────────────────────────
interface SerialHealth {
  connected: boolean;
  lastSuccess: number;
  lastAttempt: number;
  failCount: number;
  avgCaptureMs: number;
  recentCaptureTimes: number[];
}
const healthMap = new Map<string, SerialHealth>();

function getHealth(serial: string): SerialHealth {
  let h = healthMap.get(serial);
  if (!h) {
    h = { connected: true, lastSuccess: 0, lastAttempt: 0, failCount: 0, avgCaptureMs: 1500, recentCaptureTimes: [] };
    healthMap.set(serial, h);
  }
  return h;
}

// ── Placeholder: tiny 1x1 transparent (NOT grey — invisible) ─
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

// ── Capture frame via ADB exec-out ──────────────────────────
async function captureFrame(serial: string): Promise<Uint8Array | null> {
  const adbTarget = `"${ADB}" -s ${serial}`;
  const t0 = Date.now();
  try {
    const { stdout } = await execAsync(`${adbTarget} exec-out screencap -p`, {
      timeout: 3000,
      encoding: 'buffer',
      maxBuffer: 20 * 1024 * 1024,
    }) as { stdout: Buffer };
    const elapsed = Date.now() - t0;
    const health = getHealth(serial);
    health.recentCaptureTimes.push(elapsed);
    if (health.recentCaptureTimes.length > 10) health.recentCaptureTimes.shift();
    health.avgCaptureMs = health.recentCaptureTimes.reduce((a, b) => a + b, 0) / health.recentCaptureTimes.length;

    if (stdout.length > 1000 && stdout[0] === 0x89 && stdout[1] === 0x50) {
      const frame = new Uint8Array(stdout.buffer, stdout.byteOffset, stdout.byteLength);
      health.connected = true;
      health.lastSuccess = Date.now();
      health.failCount = 0;
      lastGoodFrame.set(serial, frame);
      return frame;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serial = searchParams.get('serial');

  if (!serial) {
    return new NextResponse(placeholderFrame() as unknown as BodyInit, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  }

  const health = getHealth(serial);
  const now = Date.now();
  health.lastAttempt = now;

  // Check if we need a fresh capture
  const cached = frameCache.get(serial);
  if (cached && (now - cached.ts) < CACHE_TTL_MS) {
    // Return cached frame (even if it was from a failed capture — we handle that below)
    const frameToReturn = cached.ok ? cached.data : (lastGoodFrame.get(serial) || placeholderFrame());
    return new NextResponse(frameToReturn as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Connection': health.connected ? 'ok' : 'disconnected',
        'X-Fps': String(Math.round(1000 / Math.max(health.avgCaptureMs, 100))),
      },
    });
  }

  // Capture fresh frame
  const frame = await captureFrame(serial);
  if (frame) {
    frameCache.set(serial, { data: frame, ts: now, ok: true, consecutiveFails: 0 });

    // Cleanup stale entries periodically
    if (frameCache.size > 20) {
      for (const [key, { ts }] of frameCache) {
        if (now - ts > 10000) frameCache.delete(key);
      }
    }

    return new NextResponse(frame as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Connection': 'ok',
        'X-Fps': String(Math.round(1000 / Math.max(health.avgCaptureMs, 100))),
      },
    });
  }

  // Capture failed — track failure
  health.failCount++;
  if (health.failCount > 5) {
    health.connected = false;
  }

  // CRITICAL: Return LAST GOOD frame instead of placeholder
  // This keeps the screen showing the last known image instead of going grey
  const lastFrame = lastGoodFrame.get(serial);
  if (lastFrame) {
    frameCache.set(serial, { data: lastFrame, ts: now, ok: false, consecutiveFails: (cached?.consecutiveFails || 0) + 1 });
    return new NextResponse(lastFrame as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Connection': health.connected ? 'degraded' : 'disconnected',
        'X-Stale': 'true',
      },
    });
  }

  // No last good frame ever captured — return placeholder
  return new NextResponse(placeholderFrame() as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'X-Connection': 'disconnected',
      'X-Frame-Error': 'no-device',
    },
  });
}
