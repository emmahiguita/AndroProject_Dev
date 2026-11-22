// ============================================================================
// ARCHIVO: stream-recorder.ts
// QUÉ HACE: Gestiona la grabación de pantalla MP4 en segundo plano usando
//           scrcpy 4.x (--no-playback --video-bit-rate --record), incluyendo
//           captura resiliente en MKV y remux automático a MP4 (+faststart).
// CÓMO FUNCIONA: Graba primero en contenedor Matroska (.mkv) para que la
//           terminación de proceso en Windows nunca pierda el índice de video,
//           y al detener ejecuta `ffmpeg -c copy -movflags +faststart` a `.mp4`.
// POR QUÉ: En scrcpy 4.x `--bit-rate` fue eliminado (`--video-bit-rate`) y en
//           Windows `TerminateProcess` corrompía MP4 directos sin átomo `moov`.
// ============================================================================

import { NextResponse } from 'next/server';
import { spawn, execFile, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import type { ActionContext } from './context';
import {
  ANDROPROJECT_BIN, ANDROPROJECT_HOME, SCREENSHOTS_DIR, ADB,
  SCRCPY_SERVER_PATH, SCRCPY_ICON_PATH,
  getRecordLockFile, writeLock, readLock, deleteLock, isLockAlive, killLockedProcess,
} from '@/lib/config';
import { BinaryResolver } from '@/lib/services/binary-resolver';

const execFileAsync = promisify(execFile);
const activeRecordProcs = new Map<string, ChildProcess>();

export interface StartRecordBody {
  videoSource?: string;
  bitRate?: string;
  maxFps?: string | number;
  maxSize?: string | number;
}

const isIosSerial = (serial: string) =>
  serial.startsWith('airplay-') || serial.startsWith('apple-');

function waitForExit(proc: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (proc.exitCode !== null || proc.killed) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => { proc.removeListener('exit', onExit); resolve(false); }, timeoutMs);
    const onExit = () => { clearTimeout(timer); resolve(true); };
    proc.once('exit', onExit);
  });
}

/** Convierte el MKV temporal a MP4 con átomo moov al inicio (+faststart) sin recodificar. */
async function remuxMkvToMp4(mkvPath: string, mp4Path: string): Promise<string | null> {
  if (!fs.existsSync(mkvPath) || fs.statSync(mkvPath).size === 0) return null;
  try {
    const ffmpegBin = BinaryResolver.resolveFfmpeg();
    await execFileAsync(ffmpegBin, [
      '-y', '-i', mkvPath, '-c', 'copy', '-movflags', '+faststart', mp4Path,
    ], { windowsHide: true, timeout: 15000 });
    if (fs.existsSync(mp4Path) && fs.statSync(mp4Path).size > 0) {
      try { fs.unlinkSync(mkvPath); } catch {}
      return mp4Path;
    }
  } catch { /* Si ffmpeg no está disponible, conserva el MKV válido */ }
  return mkvPath;
}

/** Inicia la grabación en segundo plano para un dispositivo Android. */
export async function startRecord(ctx: ActionContext, body: StartRecordBody) {
  const targetSerial = ctx.targetSerial || '';
  if (!targetSerial) {
    return NextResponse.json({ success: false, error: 'No hay un dispositivo conectado' }, { status: 400 });
  }
  if (isIosSerial(targetSerial)) {
    return NextResponse.json({
      success: false,
      error: 'La grabación directa por scrcpy solo es compatible con dispositivos Android (ADB).',
    }, { status: 400 });
  }
  if (ANDROPROJECT_BIN !== 'scrcpy' && !fs.existsSync(ANDROPROJECT_BIN)) {
    return NextResponse.json({ success: false, error: `Binario scrcpy no encontrado en ${ANDROPROJECT_BIN}` }, { status: 500 });
  }

  const recordLockFile = getRecordLockFile(targetSerial);
  if (await isLockAlive(recordLockFile)) {
    return NextResponse.json({ success: false, error: 'Ya hay una grabación en curso para este dispositivo' }, { status: 409 });
  }
  deleteLock(recordLockFile);

  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tempMkvPath = path.join(SCREENSHOTS_DIR, `grabacion_${timestamp}.mkv`);
  const finalMp4Path = path.join(SCREENSHOTS_DIR, `grabacion_${timestamp}.mp4`);

  const recordArgs: string[] = [
    '-s', String(targetSerial), '--video-codec=h264',
    `--video-bit-rate=${body.bitRate || '16M'}`, `--max-fps=${body.maxFps || '60'}`, `--max-size=${body.maxSize || '0'}`,
    '--port=27300:27399', '--no-playback', '--no-audio', '--record-format=mkv', `--record=${tempMkvPath}`,
  ];
  if (body.videoSource === 'camera') recordArgs.push('--video-source=camera', '--camera-facing=back');

  const envPath = `${path.dirname(ANDROPROJECT_BIN)};${path.dirname(ADB)};${process.env.PATH || ''}`;
  let earlyError = '';
  const proc = spawn(ANDROPROJECT_BIN, recordArgs, {
    cwd: ANDROPROJECT_HOME,
    env: { ...process.env, PATH: envPath, ADB, SCRCPY_SERVER_PATH, SCRCPY_ICON_PATH },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  proc.stderr?.on('data', (chunk: Buffer) => { if (earlyError.length < 600) earlyError += chunk.toString('utf8'); });
  if (!proc.pid) return NextResponse.json({ success: false, error: 'No se pudo iniciar el proceso de grabación' }, { status: 500 });

  writeLock(recordLockFile, { pid: proc.pid, serial: targetSerial, path: finalMp4Path, processName: path.basename(ANDROPROJECT_BIN), owner: 'recording' });
  activeRecordProcs.set(targetSerial, proc);

  const cleanup = () => { activeRecordProcs.delete(targetSerial); deleteLock(recordLockFile); };
  proc.once('exit', cleanup);
  proc.once('error', cleanup);

  const exitedEarly = await waitForExit(proc, 550);
  if (exitedEarly) {
    cleanup();
    try { if (fs.existsSync(tempMkvPath) && fs.statSync(tempMkvPath).size === 0) fs.unlinkSync(tempMkvPath); } catch {}
    return NextResponse.json({
      success: false,
      error: earlyError.trim().split('\n')[0] || 'scrcpy cerró inesperadamente al iniciar la grabación',
    }, { status: 422 });
  }

  return NextResponse.json({
    success: true,
    message: 'Grabación MP4 iniciada',
    recordPath: finalMp4Path,
  });
}

/** Detiene la grabación activa y empaqueta el video final en MP4 reproducible. */
export async function stopRecord(ctx: ActionContext) {
  const targetSerial = ctx.targetSerial || 'default';
  const recordLockFile = getRecordLockFile(targetSerial);
  const lock = fs.existsSync(recordLockFile) ? readLock(recordLockFile) : null;
  const targetMp4Path = typeof lock?.path === 'string' ? lock.path : null;
  const tempMkvPath = targetMp4Path ? targetMp4Path.replace(/\.mp4$/i, '.mkv') : null;
  const proc = activeRecordProcs.get(targetSerial);

  if (proc && proc.exitCode === null) {
    try { proc.kill('SIGINT'); } catch {}
    await waitForExit(proc, 1200);
  }
  if (fs.existsSync(recordLockFile)) {
    await killLockedProcess(recordLockFile);
  }
  activeRecordProcs.delete(targetSerial);

  const savedPath = (tempMkvPath && targetMp4Path)
    ? await remuxMkvToMp4(tempMkvPath, targetMp4Path)
    : null;

  if (!savedPath && tempMkvPath && fs.existsSync(tempMkvPath)) {
    try { fs.unlinkSync(tempMkvPath); } catch {}
  }

  return NextResponse.json({
    success: Boolean(savedPath),
    message: savedPath
      ? `Grabación guardada: ${path.basename(savedPath)}`
      : 'Grabación detenida (sin datos suficientes)',
    recordPath: savedPath,
  });
}

/** Consulta si existe una grabación activa en curso para sincronizar el estado de la UI. */
export async function checkRecord(ctx: ActionContext) {
  const targetSerial = ctx.targetSerial || 'default';
  const recordLockFile = getRecordLockFile(targetSerial);
  const recording = await isLockAlive(recordLockFile);
  const lock = recording ? readLock(recordLockFile) : null;
  return NextResponse.json({
    success: true,
    recording,
    startedAt: typeof lock?.startedAt === 'number' ? lock.startedAt : undefined,
    recordPath: typeof lock?.path === 'string' ? lock.path : undefined,
  });
}
