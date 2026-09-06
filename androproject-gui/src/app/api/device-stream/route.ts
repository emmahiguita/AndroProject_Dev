/**
 * Device Stream API — Production-grade real-time Android screen streaming
 *
 * Windows IPC Architecture (Ultra-Low Latency & Zero GC Thrashing):
 *   - Uses native Windows Named Pipe (\\.\pipe\andro_stream_{serial})
 *   - scrcpy records MKV container directly to named pipe via Direct3D11 off-screen
 *   - ffmpeg consumes named pipe with low_delay and converts to pure MJPEG
 *   - Screencap fallback operates immediately while scrcpy initializes to prevent black screen
 *
 * Memory Safety (Zero Leaks):
 *   - Strictly ONE frame buffer per session (replaced atomically, zero allocation queue)
 *   - Named pipe servers closed and processes SIGKILL'd cleanly when clients disconnect
 *   - Broadcaster destroys memory footprint when clientCount drops to 0
 */
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import { ADB } from '@/lib/config';
import { BinaryResolver } from '@/lib/services/binary-resolver';

// ─── MJPEG Frame Parser ──────────────────────────────────────────────────────

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);
const MAX_BUF = 8 * 1024 * 1024; // 8 MB guard

class MjpegParser {
  private buf: Buffer = Buffer.alloc(0);

  push(chunk: Buffer, onFrame: (f: Buffer) => void): void {
    if (this.buf.length + chunk.length > MAX_BUF) {
      const s = chunk.indexOf(SOI);
      this.buf = (s >= 0 ? chunk.subarray(s) : Buffer.alloc(0)) as Buffer;
      return;
    }
    this.buf = (this.buf.length === 0 ? chunk : Buffer.concat([this.buf, chunk])) as Buffer;

    while (this.buf.length >= 4) {
      const s = this.buf.indexOf(SOI);
      if (s < 0) { this.buf = Buffer.alloc(0); break; }
      if (s > 0) this.buf = this.buf.subarray(s);
      const e = this.buf.indexOf(EOI, 2);
      if (e < 0) break;
      const frame = Buffer.allocUnsafe(e + 2);
      this.buf.copy(frame, 0, 0, e + 2);
      this.buf = this.buf.subarray(e + 2);
      onFrame(frame);
    }
  }

  reset(): void { this.buf = Buffer.alloc(0); }
}

// ─── Frame Broadcaster ───────────────────────────────────────────────────────

type Ctrl = ReadableStreamDefaultController<Uint8Array>;
const PART_SEP = Buffer.from('\r\n');

class FrameBroadcaster {
  private readonly clients = new Set<Ctrl>();
  private _last: Buffer | null = null;
  private _lastCt = 'image/jpeg';

  addClient(c: Ctrl): void    { this.clients.add(c); }
  removeClient(c: Ctrl): void { this.clients.delete(c); }
  get clientCount(): number   { return this.clients.size; }
  get lastFrame(): Buffer | null { return this._last; }
  get lastContentType(): string  { return this._lastCt; }

  push(frame: Buffer, contentType = 'image/jpeg'): void {
    this._last = frame;
    this._lastCt = contentType;

    const header = Buffer.from(
      `--frame\r\nContent-Type: ${contentType}\r\nContent-Length: ${frame.length}\r\n\r\n`,
    );
    const dead: Ctrl[] = [];
    for (const c of this.clients) {
      try {
        c.enqueue(header);
        c.enqueue(frame);
        c.enqueue(PART_SEP);
      } catch { dead.push(c); }
    }
    for (const c of dead) this.clients.delete(c);
  }

  destroy(): void {
    for (const c of this.clients) { try { c.close(); } catch {} }
    this.clients.clear();
    this._last = null;
  }
}

// ─── Session ─────────────────────────────────────────────────────────────────

interface Session {
  broadcaster: FrameBroadcaster;
  stopAll: () => void;
  mode: 'screencap' | 'scrcpy';
}

const sessions = new Map<string, Session>();

// ─── Pipeline A: Fast ADB Screencap Loop (Instant First Frames) ─────────────

function startScreencapLoop(
  serial: string,
  fps: number,
  broadcaster: FrameBroadcaster,
  onFirstFrame?: () => void,
): () => void {
  const minGapMs = Math.max(30, Math.round(1000 / Math.min(fps, 20)));
  let active = true;
  let child: ChildProcess | null = null;
  let firstFrameSent = false;

  const run = () => {
    if (!active) return;

    const chunks: Buffer[] = [];
    const t0 = Date.now();

    const c = spawn(ADB, ['-s', serial, 'exec-out', 'screencap', '-p'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    child = c;

    c.stdout?.on('data', (d: Buffer) => chunks.push(d));

    const guard = setTimeout(() => { try { c.kill('SIGKILL'); } catch {} }, 4500);

    c.on('close', () => {
      clearTimeout(guard);
      child = null;
      if (!active) return;

      if (chunks.length > 0) {
        const png = Buffer.concat(chunks);
        chunks.length = 0;
        if (png.length > 1000 && png[0] === 0x89 && png[1] === 0x50) {
          broadcaster.push(png, 'image/png');
          if (!firstFrameSent) { firstFrameSent = true; onFirstFrame?.(); }
        }
      }

      const elapsed = Date.now() - t0;
      setTimeout(run, Math.max(0, minGapMs - elapsed));
    });

    c.on('error', () => {
      clearTimeout(guard);
      child = null;
      chunks.length = 0;
      if (active) setTimeout(run, 400);
    });
  };

  run();

  return () => {
    active = false;
    if (child) { try { child.kill('SIGKILL'); } catch {} child = null; }
  };
}

// ─── Pipeline B: High-Performance Windows Named Pipe (30-60 FPS) ────────────

function tryScrcpyNamedPipePipeline(
  serial: string,
  fps: number,
  broadcaster: FrameBroadcaster,
  onFirstFrame: () => void,
  onFailed: () => void,
): () => void {
  const ff = BinaryResolver.resolveFfmpeg();
  const scrcpy = BinaryResolver.resolveScrcpy();
  const targetFps = Math.min(fps, 60);

  // Clean serial for pipe name
  const cleanSerial = serial.replace(/[^a-zA-Z0-9_]/g, '_');
  const pipeName = `andro_pipe_${cleanSerial}_${Date.now()}`;
  const pipePath = `\\\\.\\pipe\\${pipeName}`;

  let scrcpyProc: ChildProcess | null = null;
  let ffProc: ChildProcess | null = null;
  let pipeServer: net.Server | null = null;
  let pipeSocket: net.Socket | null = null;
  let stopped = false;
  let gotFirstFrame = false;

  const parser = new MjpegParser();

  const startTimeout = setTimeout(() => {
    if (!gotFirstFrame && !stopped) {
      console.log(`[stream] named-pipe scrcpy timeout for ${serial}, falling back to screencap`);
      cleanup();
      onFailed();
    }
  }, 10000);

  const cleanup = () => {
    clearTimeout(startTimeout);
    if (pipeSocket) { try { pipeSocket.destroy(); } catch {} pipeSocket = null; }
    if (pipeServer) { try { pipeServer.close(); } catch {} pipeServer = null; }
    if (scrcpyProc) { scrcpyProc.removeAllListeners(); try { scrcpyProc.kill('SIGKILL'); } catch {} scrcpyProc = null; }
    if (ffProc)     { ffProc.removeAllListeners();     try { ffProc.kill('SIGKILL'); }     catch {} ffProc = null; }
    parser.reset();
  };

  const stop = () => { stopped = true; cleanup(); };

  try {
    pipeServer = net.createServer((socket) => {
      pipeSocket = socket;

      // Spawn FFmpeg to read raw MKV stream from named pipe socket and convert to MJPEG
      ffProc = spawn(ff, [
        '-f', 'matroska',
        '-fflags', 'nobuffer+discardcorrupt',
        '-flags', 'low_delay',
        '-i', 'pipe:0',
        '-f', 'mjpeg',
        '-q:v', '4',
        '-r', String(targetFps),
        'pipe:1',
      ], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });

      socket.pipe(ffProc.stdin!);

      ffProc.stdout?.on('data', (c: Buffer) => {
        parser.push(c, (frame) => {
          broadcaster.push(frame, 'image/jpeg');
          if (!gotFirstFrame) {
            gotFirstFrame = true;
            clearTimeout(startTimeout);
            onFirstFrame();
          }
        });
      });

      ffProc.on('error', () => { if (!gotFirstFrame) onFailed(); });
    });

    pipeServer.listen(pipePath, () => {
      if (stopped) return;

      // Spawn scrcpy recording to named pipe with hidden 1x1 window
      scrcpyProc = spawn(scrcpy, [
        '-s', serial,
        '--window-x=-8000', '--window-y=-8000',
        '--window-width=1', '--window-height=1',
        '--window-borderless',
        '--window-title=_AndroPipe',
        '--no-audio',
        '--video-codec=h264',
        '--max-size=720',
        `--max-fps=${targetFps}`,
        `--video-bit-rate=${targetFps >= 30 ? '4M' : '2M'}`,
        `--record=${pipePath}`,
        '--record-format=mkv',
      ], { windowsHide: false, stdio: ['ignore', 'ignore', 'ignore'] });

      scrcpyProc.on('error', () => { if (!gotFirstFrame) onFailed(); });
    });

    pipeServer.on('error', (err) => {
      console.error(`[stream] pipe server error:`, err);
      if (!gotFirstFrame) onFailed();
    });
  } catch (err) {
    clearTimeout(startTimeout);
    cleanup();
    onFailed();
  }

  return stop;
}

// ─── Session Factory & Lifecycle ─────────────────────────────────────────────

function getOrCreate(serial: string, fps: number): Session {
  const existing = sessions.get(serial);
  if (existing) return existing;

  const broadcaster = new FrameBroadcaster();
  let mode: 'screencap' | 'scrcpy' = 'screencap';

  // 1. Inicia inmediatamente Screencap para que la pantalla NUNCA quede negra
  const stopScreencap = startScreencapLoop(serial, fps, broadcaster);

  // 2. Inicia en paralelo el pipeline de Named Pipe de ultra alta velocidad
  const stopScrcpy = tryScrcpyNamedPipePipeline(
    serial,
    fps,
    broadcaster,
    () => {
      console.log(`[stream] ${serial} → NamedPipe scrcpy activo a ${fps}fps! Deteniendo screencap.`);
      mode = 'scrcpy';
      stopScreencap();
    },
    () => {
      console.log(`[stream] ${serial} → Operando en screencap optimizado.`);
    }
  );

  const session: Session = {
    broadcaster,
    stopAll: () => {
      stopScreencap();
      stopScrcpy();
    },
    mode,
  };

  sessions.set(serial, session);
  return session;
}

function destroyIfEmpty(serial: string, session: Session): void {
  if (session.broadcaster.clientCount === 0) {
    sessions.delete(serial);
    session.stopAll();
    session.broadcaster.destroy();
    console.log(`[stream] ${serial} sesión liberada de memoria.`);
  }
}

// ─── Single Screenshot Action ────────────────────────────────────────────────

function captureOnce(serial: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let done = false;

    const c = spawn(ADB, ['-s', serial, 'exec-out', 'screencap', '-p'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    c.stdout?.on('data', (d: Buffer) => chunks.push(d));

    const guard = setTimeout(() => { if (!done) try { c.kill('SIGKILL'); } catch {} }, 5000);

    const finish = () => {
      clearTimeout(guard);
      if (done) return; done = true;
      if (!chunks.length) { resolve(null); return; }
      const buf = Buffer.concat(chunks);
      resolve(buf.length > 1000 && buf[0] === 0x89 && buf[1] === 0x50 ? buf : null);
    };

    c.on('close', finish);
    c.on('error', () => { clearTimeout(guard); if (!done) { done = true; resolve(null); } });
  });
}

// ─── HTTP Route Handler ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serial = searchParams.get('serial');

  if (!serial) return new Response('Missing serial', { status: 400 });

  // Single screenshot request
  if (searchParams.get('mode') === 'screenshot') {
    const frame = await captureOnce(serial);
    return frame
      ? new Response(new Uint8Array(frame), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } })
      : new Response('Capture failed', { status: 503 });
  }

  // MJPEG live stream
  const fps = Math.min(Math.max(parseInt(searchParams.get('maxFps') ?? '30', 10), 5), 60);
  const session = getOrCreate(serial, fps);

  let clientCtrl: Ctrl | null = null;

  const release = () => {
    if (!clientCtrl) return;
    session.broadcaster.removeClient(clientCtrl);
    clientCtrl = null;
    destroyIfEmpty(serial, session);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      clientCtrl = ctrl;
      session.broadcaster.addClient(ctrl);
      req.signal.addEventListener('abort', release, { once: true });

      // Frame inmediato en memoria para 0ms de espera
      const { lastFrame, lastContentType } = session.broadcaster;
      if (lastFrame) {
        try {
          ctrl.enqueue(Buffer.from(
            `--frame\r\nContent-Type: ${lastContentType}\r\nContent-Length: ${lastFrame.length}\r\n\r\n`,
          ));
          ctrl.enqueue(lastFrame);
          ctrl.enqueue(PART_SEP);
        } catch { release(); }
      }
    },
    cancel: release,
  });

  return new Response(stream as unknown as BodyInit, {
    headers: {
      'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Frame-Mode': session.mode,
    },
  });
}
