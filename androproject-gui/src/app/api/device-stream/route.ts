// ============================================================================
// ARCHIVO: route.ts (device-stream)
// QUÉ HACE: Expone el endpoint HTTP `GET /api/device-stream` para entregar
//           capturas PNG individuales o stream MJPEG en vivo por dispositivo.
// CÓMO FUNCIONA: Valida `serial` con `isValidDeviceSerial`, delega iOS a
//           `handleIosDeviceStream` y gestiona sesiones Android mediante
//           `FrameBroadcaster` y los pipelines de `_lib/stream-pipelines.ts`.
// POR QUÉ: Mantener el route handler < 200 líneas (SRP), validar el serial
//           contra caracteres peligrosos y exponer el modo vivo en `X-Frame-Mode`.
// ============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { ADB } from '@/lib/config';
import { isValidDeviceSerial } from '@/lib/security/input-sanitizer';
import { isIosStreamSerial, handleIosDeviceStream } from '@/lib/services/ios-stream-handler';
import {
  FrameBroadcaster,
  PART_SEP,
  startScreencapLoop,
  tryScrcpyNamedPipePipeline,
  type Ctrl,
} from './_lib/stream-pipelines';

interface Session {
  broadcaster: FrameBroadcaster;
  stopAll: () => void;
  getMode: () => 'screencap' | 'scrcpy';
}

const sessions = new Map<string, Session>();

function getOrCreate(serial: string, fps: number): Session {
  const existing = sessions.get(serial);
  if (existing) return existing;

  const broadcaster = new FrameBroadcaster();
  let mode: 'screencap' | 'scrcpy' = 'screencap';

  const stopScreencap = startScreencapLoop(serial, fps, broadcaster);
  const stopScrcpy = tryScrcpyNamedPipePipeline(
    serial,
    fps,
    broadcaster,
    () => { mode = 'scrcpy'; stopScreencap(); },
    () => {},
  );

  const session: Session = {
    broadcaster,
    stopAll: () => { stopScreencap(); stopScrcpy(); },
    getMode: () => mode,
  };

  sessions.set(serial, session);
  return session;
}

function destroyIfEmpty(serial: string, session: Session): void {
  if (session.broadcaster.clientCount === 0) {
    sessions.delete(serial);
    session.stopAll();
    session.broadcaster.destroy();
  }
}

function captureOnce(serial: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let done = false;
    const c = spawn(ADB, ['-s', serial, 'exec-out', 'screencap', '-p'], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
    });
    c.stdout?.on('data', (d: Buffer) => chunks.push(d));
    const guard = setTimeout(() => { if (!done) try { c.kill('SIGKILL'); } catch {} }, 5000);

    const finish = () => {
      clearTimeout(guard);
      if (done) return;
      done = true;
      if (!chunks.length) { resolve(null); return; }
      const buf = Buffer.concat(chunks);
      resolve(buf.length > 1000 && buf[0] === 0x89 && buf[1] === 0x50 ? buf : null);
    };

    c.on('close', finish);
    c.on('error', () => { clearTimeout(guard); if (!done) { done = true; resolve(null); } });
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serial = searchParams.get('serial');
  if (!serial) return new Response('Missing serial', { status: 400 });

  if (isIosStreamSerial(serial)) {
    return handleIosDeviceStream(
      serial,
      searchParams.get('mode'),
      parseInt(searchParams.get('maxFps') ?? '30', 10),
      req.signal,
    );
  }

  if (!isValidDeviceSerial(serial)) {
    return new Response('Invalid serial', { status: 400 });
  }

  if (searchParams.get('mode') === 'screenshot') {
    const frame = await captureOnce(serial);
    return frame
      ? new Response(new Uint8Array(frame), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } })
      : new Response('Capture failed', { status: 503 });
  }

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
      'X-Frame-Mode': session.getMode(),
    },
  });
}
