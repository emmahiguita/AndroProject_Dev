/**
 * Real-time device streaming via scrcpy + ffmpeg → MJPEG.
 *
 * Architecture:
 *   scrcpy --no-window --record=- → ffmpeg -f matroska -i pipe:0 -f mjpeg pipe:1
 *   Response is multipart/x-mixed-replace (MJPEG stream)
 *   <img src="/api/device-stream?serial=xxx"> auto-plays the stream at ~30fps.
 *
 * Reliability features:
 *   - Auto-restart: when scrcpy/ffmpeg exit unexpectedly, pipeline restarts
 *   - Max restart cap: prevents infinite restart loops (5 per 60s window)
 *   - Connection health: tracks consecutive failures per serial
 *   - Graceful shutdown: cleans up processes on client disconnect
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ADB } from '@/lib/config';

// ── Binary paths ────────────────────────────────────
function findScrcpy(): string {
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

function findFfmpeg(): string {
  const wingetPkgs = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  const candidates: string[] = [];

  try {
    for (const pkg of fs.readdirSync(wingetPkgs)) {
      if (!pkg.startsWith('Gyan.FFmpeg')) continue;
      const binDir = path.join(wingetPkgs, pkg, 'ffmpeg-*', 'bin');
      try {
        for (const release of fs.readdirSync(binDir.replace('*', ''))) {
          const full = path.join(binDir.replace('*', ''), release, 'ffmpeg.exe');
          if (fs.existsSync(full)) candidates.push(full);
        }
      } catch {}
      const direct = path.join(wingetPkgs, pkg);
      try {
        for (const release of fs.readdirSync(direct)) {
          if (!release.startsWith('ffmpeg-')) continue;
          const binPath = path.join(direct, release, 'bin', 'ffmpeg.exe');
          if (fs.existsSync(binPath)) candidates.push(binPath);
        }
      } catch {}
    }
  } catch {}

  const linkPath = path.join(wingetPkgs, '..', 'Links', 'ffmpeg.exe');
  if (fs.existsSync(linkPath)) candidates.push(linkPath);

  candidates.push('C:\\ffmpeg\\bin\\ffmpeg.exe', 'ffmpeg');
  return candidates.find(c => {
    try { return fs.existsSync(c); } catch { return false; }
  }) || 'ffmpeg';
}

const SCRCPY = findScrcpy();
const FFMPEG = findFfmpeg();

console.log(`[device-stream] scrcpy: ${SCRCPY}`);
console.log(`[device-stream] ffmpeg: ${FFMPEG}`);

// ── Restart throttle ────────────────────────────────
const MAX_RESTARTS = 5;
const RESTART_WINDOW_MS = 60_000;

interface RestartTracker {
  count: number;
  windowStart: number;
}
const restartTrackers = new Map<string, RestartTracker>();

function canRestart(serial: string): boolean {
  const now = Date.now();
  let tracker = restartTrackers.get(serial);
  if (!tracker || (now - tracker.windowStart) > RESTART_WINDOW_MS) {
    tracker = { count: 0, windowStart: now };
    restartTrackers.set(serial, tracker);
  }
  tracker.count++;
  return tracker.count <= MAX_RESTARTS;
}

// ── Process registry (one stream per serial) ─────────
interface StreamEntry {
  scrcpy: ChildProcess;
  ffmpeg: ChildProcess;
  clients: Set<ReadableStreamDefaultController>;
  refCount: number;
  restarting: boolean;
  destroyed: boolean;
}
const activeStreams = new Map<string, StreamEntry>();

function destroyStream(serial: string) {
  const stream = activeStreams.get(serial);
  if (!stream) return;
  stream.destroyed = true;

  try { stream.scrcpy.kill('SIGTERM'); } catch {}
  try { stream.ffmpeg.kill('SIGTERM'); } catch {}
  setTimeout(() => {
    try { stream.scrcpy.kill('SIGKILL'); } catch {}
    try { stream.ffmpeg.kill('SIGKILL'); } catch {}
  }, 2000);

  for (const controller of stream.clients) {
    try { controller.close(); } catch {}
  }
  activeStreams.delete(serial);
}

function cleanupStream(serial: string) {
  const stream = activeStreams.get(serial);
  if (!stream) return;
  stream.refCount--;
  if (stream.refCount <= 0 || stream.clients.size === 0) {
    console.log(`[device-stream] Stopping stream for ${serial} (no more active clients)`);
    destroyStream(serial);
  }
}

// ── Spawn scrcpy + ffmpeg pipeline ──────────────────
function spawnPipeline(serial: string): {
  scrcpy: ChildProcess;
  ffmpeg: ChildProcess;
} {
  // scrcpy v2+ streams to stdout via --video-output:
  //   raw   → H.264 Annex-B NAL units on stdout
  //   muxed → mkv container on stdout
  // (--record=- is NOT supported → pipeline hangs → black screen)
  const scrcpy = spawn(SCRCPY, [
    '-s', serial,
    '--no-window',
    '--no-audio',
    '--video-codec=h264',
    '--max-size=720',
    '--max-fps=30',
    '--video-bit-rate=8M',
    '--stay-awake',
    '--video-output=raw',
  ], {
    env: { ...process.env, ADB },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const ffmpeg = spawn(FFMPEG, [
    '-f', 'h264',
    '-i', 'pipe:0',
    '-f', 'mjpeg',
    '-q:v', '4',
    '-r', '30',
    '-vf', 'scale=480:-2',
    'pipe:1',
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  // Pipe scrcpy stdout → ffmpeg stdin
  scrcpy.stdout?.pipe(ffmpeg.stdin);

  // Log stderr
  scrcpy.stderr?.on('data', (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (msg) console.log(`[device-stream] scrcpy: ${msg}`);
  });

  ffmpeg.stderr?.on('data', (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (msg && !msg.includes('frame=')) console.log(`[device-stream] ffmpeg: ${msg}`);
  });

  return { scrcpy, ffmpeg };
}

// ── MJPEG frame extraction + broadcast ──────────────
function attachFrameHandler(
  ffmpeg: ChildProcess,
  clients: Set<ReadableStreamDefaultController>,
  serial: string,
) {
  let buffer = Buffer.alloc(0);
  const SOI = Buffer.from([0xFF, 0xD8]);
  const EOI = Buffer.from([0xFF, 0xD9]);

  ffmpeg.stdout?.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const soiStart = buffer.indexOf(SOI);
      if (soiStart === -1) {
        // Keep last 2 bytes (could be partial SOI marker)
        buffer = buffer.length >= 2 ? buffer.subarray(buffer.length - 2) : Buffer.alloc(0);
        break;
      }

      // Discard data before SOI (not part of a JPEG)
      if (soiStart > 0) {
        buffer = buffer.subarray(soiStart);
      }

      const eoiPos = buffer.indexOf(EOI, 2);
      if (eoiPos === -1) break; // incomplete frame, wait for more data

      const frameEnd = eoiPos + 2;
      const frame = buffer.subarray(0, frameEnd);
      buffer = buffer.subarray(frameEnd);

      // Broadcast frame to all connected clients
      const boundary = Buffer.from(`\r\n--frame\r\nContent-Type: image/jpeg\r\n\r\n`);

      for (const controller of Array.from(clients)) {
        try {
          controller.enqueue(boundary);
          controller.enqueue(frame);
        } catch {
          clients.delete(controller);
          if (clients.size === 0) {
            cleanupStream(serial);
          }
        }
      }
    }
  });
}

// ── Auto-restart on unexpected exit ─────────────────
function setupExitHandlers(
  entry: StreamEntry,
  serial: string,
) {
  const { scrcpy, ffmpeg, clients } = entry;

  const onBothExited = () => {
    if (entry.destroyed) return;

    // Check if either process exited with an error
    const scrcpyCode = scrcpy.exitCode;
    const ffmpegCode = ffmpeg.exitCode;

    // Normal termination (code 0 or null) = intentional stop
    if (scrcpyCode === 0 && ffmpegCode === 0) {
      console.log(`[device-stream] Stream ended normally for ${serial}`);
      for (const c of clients) { try { c.close(); } catch {} }
      activeStreams.delete(serial);
      return;
    }

    // Unexpected exit — attempt restart
    console.log(`[device-stream] Pipeline exited unexpectedly for ${serial} (scrcpy=${scrcpyCode}, ffmpeg=${ffmpegCode})`);

    if (!canRestart(serial)) {
      console.log(`[device-stream] Max restarts reached for ${serial}, giving up`);
      for (const c of clients) { try { c.close(); } catch {} }
      activeStreams.delete(serial);
      return;
    }

    if (entry.restarting) return;
    entry.restarting = true;

    // Wait 1s then restart
    setTimeout(() => {
      if (entry.destroyed) return;
      console.log(`[device-stream] Restarting pipeline for ${serial}`);

      try { scrcpy.kill('SIGKILL'); } catch {}
      try { ffmpeg.kill('SIGKILL'); } catch {}

      try {
        const { scrcpy: newScrcpy, ffmpeg: newFfmpeg } = spawnPipeline(serial);
        entry.scrcpy = newScrcpy;
        entry.ffmpeg = newFfmpeg;
        entry.restarting = false;

        attachFrameHandler(newFfmpeg, clients, serial);
        setupExitHandlers(entry, serial);
      } catch (err) {
        console.error(`[device-stream] Restart failed for ${serial}:`, err);
        entry.restarting = false;
        for (const c of clients) { try { c.close(); } catch {} }
        activeStreams.delete(serial);
      }
    }, 1000);
  };

  scrcpy.on('exit', onBothExited);
  ffmpeg.on('exit', onBothExited);

  scrcpy.on('error', (err) => {
    console.error(`[device-stream] scrcpy error for ${serial}:`, err.message);
    if (!entry.restarting) onBothExited();
  });

  ffmpeg.on('error', (err) => {
    console.error(`[device-stream] ffmpeg error for ${serial}:`, err.message);
    if (!entry.restarting) onBothExited();
  });
}

// ── Start or reuse stream for serial ────────────────
function startStream(serial: string): ReadableStream {
  const existing = activeStreams.get(serial);
  if (existing && !existing.destroyed) {
    existing.refCount++;
    return createMjpegStream(existing.clients, serial);
  }

  const clients = new Set<ReadableStreamDefaultController>();

  console.log(`[device-stream] Starting scrcpy+ffmpeg pipeline for ${serial}`);

  const { scrcpy, ffmpeg } = spawnPipeline(serial);

  const entry: StreamEntry = {
    scrcpy,
    ffmpeg,
    clients,
    refCount: 1,
    restarting: false,
    destroyed: false,
  };

  attachFrameHandler(ffmpeg, clients, serial);
  setupExitHandlers(entry, serial);
  activeStreams.set(serial, entry);

  return createMjpegStream(clients, serial);
}

// ── MJPEG ReadableStream factory ────────────────────
function createMjpegStream(
  clients: Set<ReadableStreamDefaultController>,
  serial: string,
): ReadableStream {
  return new ReadableStream({
    start(controller) {
      clients.add(controller);
      // MJPEG header: declares the boundary name
      // First boundary comes right after header (no preceding CRLF needed)
      const header = `Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n--frame\r\nContent-Type: image/jpeg\r\n\r\n`;
      controller.enqueue(Buffer.from(header));
    },
    cancel(controller) {
      for (const c of clients) {
        if (c === controller) {
          clients.delete(c);
          break;
        }
      }
      // Clean up stream when last client disconnects
      cleanupStream(serial);
    },
  });
}

// ── Screenshot fallback (used when MJPEG unavailable) ──
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

function placeholderFrame(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0x10, 0x10, 0x10, 0x18,
    0x00, 0x00, 0x06, 0x00, 0x01, 0x59, 0x27, 0xC5,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82,
  ]);
}

async function captureScreenshot(serial: string): Promise<Uint8Array | null> {
  try {
    const adbTarget = `"${ADB}" -s ${serial}`;
    const { stdout } = await execAsync(`${adbTarget} exec-out screencap -p`, {
      timeout: 15000,
      encoding: 'buffer',
      maxBuffer: 20 * 1024 * 1024,
    }) as { stdout: Buffer };
    if (stdout.length > 1000 && stdout[0] === 0x89 && stdout[1] === 0x50) {
      return new Uint8Array(stdout.buffer, stdout.byteOffset, stdout.byteLength);
    }
  } catch {}
  return null;
}

// ── GET handler ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serial = searchParams.get('serial');
  const mode = searchParams.get('mode') || 'auto';

  if (!serial) {
    return new NextResponse(placeholderFrame() as unknown as BodyInit, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  }

  // ── MJPEG streaming mode ──
  if (mode === 'mjpeg' || mode === 'auto') {
    try {
      const stream = startStream(serial);
      return new Response(stream, {
        headers: {
          'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Frame-Mode': 'scrcpy-mjpeg',
          'X-Connection': 'ok',
        },
      });
    } catch (err) {
      console.error(`[device-stream] MJPEG failed for ${serial}:`, err);
      if (mode === 'mjpeg') {
        return new Response('Stream failed', { status: 500 });
      }
    }
  }

  // ── Screenshot fallback mode ──
  const frame = await captureScreenshot(serial);
  if (frame) {
    return new NextResponse(frame as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Frame-Mode': 'screenshot',
        'X-Connection': 'ok',
      },
    });
  }

  return new NextResponse(placeholderFrame() as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'X-Frame-Error': 'capture-failed',
      'X-Connection': 'disconnected',
    },
  });
}
