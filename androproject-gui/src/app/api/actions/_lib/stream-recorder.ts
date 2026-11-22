// ============================================================================
// ARCHIVO: stream-recorder.ts
// QUÉ HACE: Gestiona la grabación de pantalla MP4 en segundo plano usando
//           scrcpy (--no-playback --record), incluyendo inicio, estado y cierre.
// CÓMO FUNCIONA: Verifica que el dispositivo sea Android y el binario exista,
//           valida que scrcpy no aborte al arrancar (450ms), guarda el proceso
//           en memoria y lock, e intenta cierre suave (SIGINT / taskkill sin /F)
//           antes de forzar kill para preservar el átomo moov del MP4.
// POR QUÉ: Desacoplar la grabación de stream.ts mantiene ambos archivos bajo
//           200 líneas y evita archivos MP4 corruptos o procesos zombis.
// ============================================================================

import { NextResponse } from 'next/server';
import { spawn, exec, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import type { ActionContext } from './context';
import {
  ANDROPROJECT_BIN, ANDROPROJECT_HOME, SCREENSHOTS_DIR, ADB,
  SCRCPY_SERVER_PATH, SCRCPY_ICON_PATH,
  getRecordLockFile, writeLock, readLock, deleteLock, isLockAlive, killLockedProcess,
} from '@/lib/config';

const execAsync = promisify(exec);
const activeRecordProcs = new Map<string, ChildProcess>();

export interface StartRecordBody {
  videoSource?: string;
  bitRate?: string;
  maxFps?: string | number;
  maxSize?: string | number;
}

const isIosSerial = (serial: string) =>
  serial.startsWith('airplay-') || serial.startsWith('apple-');

/** Espera hasta `timeoutMs` a que el proceso hijo emita `exit`. */
function waitForExit(proc: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (proc.exitCode !== null || proc.killed) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      proc.removeListener('exit', onExit);
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    proc.once('exit', onExit);
  });
}

/** Inicia la grabación MP4 sin reproducción local para un dispositivo Android. */
export async function startRecord(ctx: ActionContext, body: StartRecordBody) {
  const targetSerial = ctx.targetSerial || '';
  if (!targetSerial) {
    return NextResponse.json({ success: false, error: 'No hay un dispositivo conectado' }, { status: 400 });
  }
  if (isIosSerial(targetSerial)) {
    return NextResponse.json({
      success: false,
      error: 'La grabación MP4 directa por scrcpy solo es compatible con dispositivos Android (ADB).',
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
  const recordPath = path.join(SCREENSHOTS_DIR, `grabacion_${timestamp}.mp4`);

  const recordArgs: string[] = [
    '-s', String(targetSerial),
    '--video-codec=h264',
    `--bit-rate=${body.bitRate || '16M'}`,
    `--max-fps=${body.maxFps || '60'}`,
    `--max-size=${body.maxSize || '0'}`,
    '--no-playback',
    '--no-audio',
    '--record-format=mp4',
    `--record=${recordPath}`,
  ];
  if (body.videoSource === 'camera') {
    recordArgs.push('--video-source=camera', '--camera-facing=back');
  }

  const scrcpyDir = path.dirname(ANDROPROJECT_BIN);
  const adbDir = path.dirname(ADB);
  const envPath = `${scrcpyDir};${adbDir};${process.env.PATH || ''}`;

  let earlyError = '';
  const proc = spawn(ANDROPROJECT_BIN, recordArgs, {
    cwd: ANDROPROJECT_HOME,
    env: { ...process.env, PATH: envPath, ADB, SCRCPY_SERVER_PATH, SCRCPY_ICON_PATH },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    if (earlyError.length < 600) earlyError += chunk.toString('utf8');
  });

  if (!proc.pid) {
    return NextResponse.json({ success: false, error: 'No se pudo iniciar el proceso de grabación' }, { status: 500 });
  }

  writeLock(recordLockFile, {
    pid: proc.pid,
    serial: targetSerial,
    path: recordPath,
    processName: path.basename(ANDROPROJECT_BIN),
    owner: 'recording',
  });
  activeRecordProcs.set(targetSerial, proc);

  const cleanup = () => {
    activeRecordProcs.delete(targetSerial);
    deleteLock(recordLockFile);
  };
  proc.once('exit', cleanup);
  proc.once('error', cleanup);

  // Verifica durante 450ms que scrcpy no aborte inmediatamente por dispositivo offline o error de encoder
  const exitedEarly = await waitForExit(proc, 450);
  if (exitedEarly) {
    cleanup();
    try { if (fs.existsSync(recordPath) && fs.statSync(recordPath).size === 0) fs.unlinkSync(recordPath); } catch {}
    return NextResponse.json({
      success: false,
      error: earlyError.trim().split('\n')[0] || 'scrcpy cerró inesperadamente al iniciar la grabación',
    }, { status: 422 });
  }

  return NextResponse.json({
    success: true,
    message: 'Grabación MP4 iniciada',
    recordPath,
  });
}

/** Detiene la grabación activa intentando cierre limpio para no corromper el MP4. */
export async function stopRecord(ctx: ActionContext) {
  const targetSerial = ctx.targetSerial || 'default';
  const recordLockFile = getRecordLockFile(targetSerial);
  const lock = fs.existsSync(recordLockFile) ? readLock(recordLockFile) : null;
  const recordedPath = typeof lock?.path === 'string' ? lock.path : null;
  const proc = activeRecordProcs.get(targetSerial);

  if (proc && proc.exitCode === null) {
    try { proc.kill('SIGINT'); } catch {}
    if (lock?.pid) {
      // Intento suave sin /F primero para que scrcpy escriba el índice moov del MP4
      execAsync(`taskkill /PID ${lock.pid}`, { windowsHide: true }).catch(() => {});
    }
    await waitForExit(proc, 2500);
  }

  if (fs.existsSync(recordLockFile)) {
    await killLockedProcess(recordLockFile);
  }
  activeRecordProcs.delete(targetSerial);

  const fileValid = Boolean(recordedPath && fs.existsSync(recordedPath) && fs.statSync(recordedPath).size > 0);
  if (recordedPath && fs.existsSync(recordedPath) && !fileValid) {
    try { fs.unlinkSync(recordedPath); } catch {}
  }

  return NextResponse.json({
    success: true,
    message: fileValid && recordedPath
      ? `Grabación guardada: ${path.basename(recordedPath)}`
      : 'Grabación detenida (sin datos válidos en el archivo)',
    recordPath: fileValid ? recordedPath : null,
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
