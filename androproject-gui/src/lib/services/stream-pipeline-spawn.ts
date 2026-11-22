// ============================================================================
// ARCHIVO: stream-pipeline-spawn.ts
// QUÉ HACE: Crea y termina el pipeline hijo `scrcpy --record=- -> ffmpeg`
//           para transmisión MJPEG de baja latencia por serial.
// CÓMO FUNCIONA: Conecta `scrcpy.stdout` a `ffmpeg.stdin`, alimenta los chunks
//           MJPEG a `MjpegFrameHandler` y aplica terminación escalonada
//           `SIGTERM -> SIGKILL` solo si los procesos siguen vivos.
// POR QUÉ: Separar el spawn/kill de procesos mantiene `stream-manager.ts`
//           por debajo de 200 líneas (SRP / Clean Architecture).
// ============================================================================

import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { ADB } from '@/lib/config';
import { BinaryResolver } from './binary-resolver';
import { MjpegFrameHandler } from './mjpeg-frame-handler';

export interface StreamConfig {
  serial: string;
  maxSize?: string;
  maxFps?: string;
  bitRate?: string;
}

export interface StreamState {
  scrcpy: ChildProcess;
  ffmpeg: ChildProcess;
  frameHandler: MjpegFrameHandler;
  isActive: boolean;
  restarting: boolean;
  restartCount: number;
  lastRestart: number;
}

export function spawnScrcpyFfmpegPipeline(
  config: StreamConfig,
  frameHandler: MjpegFrameHandler,
): { scrcpy: ChildProcess; ffmpeg: ChildProcess } {
  const { serial, maxSize = '720', maxFps = '30', bitRate = '4M' } = config;
  const scrcpyPath = BinaryResolver.resolveScrcpy();
  const ffmpegPath = BinaryResolver.resolveFfmpeg();
  const scrcpyDir = path.dirname(scrcpyPath);
  const adbDir = path.dirname(ADB);
  const envPath = `${scrcpyDir};${adbDir};${process.env.PATH || ''}`;

  const scrcpy = spawn(scrcpyPath, [
    '-s', serial, '--no-playback', '--no-audio', '--display-id=0',
    '--video-codec=h264', '--max-size', maxSize, '--max-fps', maxFps,
    '-b', bitRate, '--video-buffer=0', '--stay-awake',
    '--record=-', '--record-format=mkv',
  ], {
    cwd: scrcpyDir,
    env: { ...process.env, PATH: envPath, ADB },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const ffmpegDir = path.dirname(ffmpegPath);
  const ffmpeg = spawn(ffmpegPath, [
    '-f', 'matroska', '-probesize', '32768', '-analyzeduration', '0',
    '-fflags', 'nobuffer+discardcorrupt', '-flags', 'low_delay', '-i', 'pipe:0',
    '-an', '-f', 'mjpeg', '-q:v', '3', '-r', maxFps, '-threads', '2',
    '-preset', 'ultrafast', '-tune', 'zerolatency', 'pipe:1',
  ], {
    cwd: ffmpegDir,
    env: { ...process.env, PATH: `${ffmpegDir};${envPath}` },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  scrcpy.stdout?.pipe(ffmpeg.stdin);
  ffmpeg.stdout?.on('data', (chunk: Buffer) => frameHandler.processChunk(chunk));
  scrcpy.stderr?.on('data', (d: Buffer) => console.log('[scrcpy]', d.toString().trim()));
  ffmpeg.stderr?.on('data', (d: Buffer) => console.log('[ffmpeg]', d.toString().trim()));

  return { scrcpy, ffmpeg };
}

export function killStreamProcesses(scrcpy: ChildProcess, ffmpeg: ChildProcess, timeoutMs = 1000): void {
  try { if (ffmpeg.stdin) scrcpy.stdout?.unpipe(ffmpeg.stdin); } catch {}
  try { if (scrcpy.exitCode === null) scrcpy.kill('SIGTERM'); } catch {}
  try { if (ffmpeg.exitCode === null) ffmpeg.kill('SIGTERM'); } catch {}

  if (scrcpy.exitCode === null || ffmpeg.exitCode === null) {
    setTimeout(() => {
      try { if (scrcpy.exitCode === null) scrcpy.kill('SIGKILL'); } catch {}
      try { if (ffmpeg.exitCode === null) ffmpeg.kill('SIGKILL'); } catch {}
    }, timeoutMs);
  }
}
