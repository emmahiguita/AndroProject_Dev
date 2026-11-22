// ============================================================================
// ARCHIVO: stream-pipelines.ts
// QUÉ HACE: Implementa los pipelines de captura (`startScreencapLoop` y
//           `tryScrcpyNamedPipePipeline`) para Android sobre Windows.
// CÓMO FUNCIONA: Arranca captura rápida `screencap` mientras inicializa el
//           Named Pipe `scrcpy -> ffmpeg`, limpiando timers y procesos al salir.
// POR QUÉ: Delegar parser/broadcaster a `_lib/mjpeg-broadcaster.ts` mantiene
//           este archivo < 200 líneas (SRP) y libre de fugas de timers.
// ============================================================================

import { spawn, type ChildProcess } from 'child_process';
import net from 'net';
import { ADB } from '@/lib/config';
import { BinaryResolver } from '@/lib/services/binary-resolver';
import { MjpegParser, FrameBroadcaster, PART_SEP, type Ctrl } from './mjpeg-broadcaster';

export { FrameBroadcaster, PART_SEP, type Ctrl };

/** Bucle rápido de `adb exec-out screencap -p` para mostrar primer frame inmediato. */
export function startScreencapLoop(
  serial: string,
  fps: number,
  broadcaster: FrameBroadcaster,
  onFirstFrame?: () => void,
): () => void {
  const minGapMs = Math.max(30, Math.round(1000 / Math.min(fps, 20)));
  let active = true;
  let child: ChildProcess | null = null;
  let nextTimer: ReturnType<typeof setTimeout> | null = null;
  let firstFrameSent = false;

  const run = () => {
    if (!active) return;
    const chunks: Buffer[] = [];
    const t0 = Date.now();
    const c = spawn(ADB, ['-s', serial, 'exec-out', 'screencap', '-p'], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
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
      nextTimer = setTimeout(run, Math.max(0, minGapMs - (Date.now() - t0)));
    });

    c.on('error', () => {
      clearTimeout(guard);
      child = null;
      chunks.length = 0;
      if (active) nextTimer = setTimeout(run, 400);
    });
  };

  run();
  return () => {
    active = false;
    if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
    if (child) { try { child.kill('SIGKILL'); } catch {} child = null; }
  };
}

/** Pipeline de alta velocidad vía Windows Named Pipe (`scrcpy` -> `ffmpeg` MJPEG). */
export function tryScrcpyNamedPipePipeline(
  serial: string,
  fps: number,
  broadcaster: FrameBroadcaster,
  onFirstFrame: () => void,
  onFailed: () => void,
): () => void {
  const ff = BinaryResolver.resolveFfmpeg();
  const scrcpy = BinaryResolver.resolveScrcpy();
  const targetFps = Math.min(fps, 60);
  const cleanSerial = serial.replace(/[^a-zA-Z0-9_]/g, '_');
  const pipePath = `\\\\.\\pipe\\andro_pipe_${cleanSerial}_${Date.now()}`;

  let scrcpyProc: ChildProcess | null = null;
  let ffProc: ChildProcess | null = null;
  let pipeServer: net.Server | null = null;
  let pipeSocket: net.Socket | null = null;
  let stopped = false;
  let gotFirstFrame = false;
  const parser = new MjpegParser();

  const startTimeout = setTimeout(() => {
    if (!gotFirstFrame && !stopped) { cleanup(); onFailed(); }
  }, 10000);

  const cleanup = () => {
    clearTimeout(startTimeout);
    if (pipeSocket) { try { pipeSocket.destroy(); } catch {} pipeSocket = null; }
    if (pipeServer) { try { pipeServer.close(); } catch {} pipeServer = null; }
    if (scrcpyProc) { scrcpyProc.removeAllListeners(); try { scrcpyProc.kill('SIGKILL'); } catch {} scrcpyProc = null; }
    if (ffProc) { ffProc.removeAllListeners(); try { ffProc.kill('SIGKILL'); } catch {} ffProc = null; }
    parser.reset();
  };

  try {
    pipeServer = net.createServer((socket) => {
      pipeSocket = socket;
      ffProc = spawn(ff, [
        '-f', 'matroska', '-fflags', 'nobuffer+discardcorrupt', '-flags', 'low_delay',
        '-probesize', '32', '-analyzeduration', '0', '-i', 'pipe:0',
        '-f', 'mjpeg', '-q:v', '5', '-fps_mode', 'passthrough', 'pipe:1',
      ], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });

      socket.pipe(ffProc.stdin!);
      ffProc.stdout?.on('data', (c: Buffer) => {
        parser.push(c, (frame) => {
          broadcaster.push(frame, 'image/jpeg');
          if (!gotFirstFrame) { gotFirstFrame = true; clearTimeout(startTimeout); onFirstFrame(); }
        });
      });
      ffProc.on('error', () => { if (!gotFirstFrame) onFailed(); });
    });

    pipeServer.listen(pipePath, () => {
      if (stopped) return;
      scrcpyProc = spawn(scrcpy, [
        '-s', serial, '--no-playback', '--no-audio', '--video-codec=h264',
        '--max-size=720', `--max-fps=${targetFps}`,
        `--video-bit-rate=${targetFps >= 30 ? '4M' : '2M'}`,
        `--record=${pipePath}`, '--record-format=mkv',
      ], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] });
      scrcpyProc.on('error', () => { if (!gotFirstFrame) onFailed(); });
    });

    pipeServer.on('error', () => { if (!gotFirstFrame) onFailed(); });
  } catch {
    clearTimeout(startTimeout);
    cleanup();
    onFailed();
  }

  return () => { stopped = true; cleanup(); };
}
