import { NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { safeExec, getErrorMessage } from './_lib/helpers';
import { ActionContext } from './_lib/context';
import {
  ANDROPROJECT_BIN, ANDROPROJECT_HOME, SCREENSHOTS_DIR, ADB,
  SCRCPY_SERVER_PATH, SCRCPY_ICON_PATH,
  getLockFile, getRecordLockFile,
  writeLock, readLock, deleteLock, isLockAlive, killLockedProcess,
} from '@/lib/config';

// ── Screen Streaming (scrcpy) ──────────────────────────────────────

export async function openScreen(ctx: ActionContext, body: { videoSource?: string }) {
  const targetSerial = ctx.targetSerial;
  if (!targetSerial) {
    return NextResponse.json({ success: false, error: 'No hay un dispositivo Android conectado' }, { status: 400 });
  }
  if (!fs.existsSync(ANDROPROJECT_BIN)) {
    return NextResponse.json({ success: false, error: `No se encontró el motor de transmisión en ${ANDROPROJECT_BIN}` }, { status: 503 });
  }

  const streamLockFile = getLockFile(targetSerial);
  const alive = await isLockAlive(streamLockFile, 'scrcpy');
  if (alive) {
    return NextResponse.json({ success: true, alive: true, message: 'La transmisión ya está activa' });
  }
  deleteLock(streamLockFile);

  const streamArgs = [
    '-s', String(targetSerial),
    '--video-bit-rate=16M', '--max-size=1920', '--max-fps=60',
    '--stay-awake', '--window-title', `AndroProject - ${targetSerial}`,
  ];
  if (body.videoSource === 'camera') {
    streamArgs.push('--video-source=camera', '--camera-facing=back', '--no-audio');
  }

  const streamProcess = spawn(ANDROPROJECT_BIN, streamArgs, {
    cwd: ANDROPROJECT_HOME,
    env: { ...process.env, ADB },
    windowsHide: false,
  });

  if (!streamProcess.pid) {
    return NextResponse.json({ success: false, error: 'No se pudo iniciar el motor de transmisión' }, { status: 500 });
  }

  writeLock(streamLockFile, { pid: streamProcess.pid, serial: targetSerial });
  const cleanup = () => { deleteLock(streamLockFile); };
  streamProcess.once('exit', cleanup);
  streamProcess.once('error', cleanup);

  return NextResponse.json({
    success: true, alive: true, pid: streamProcess.pid,
    message: body.videoSource === 'camera'
      ? 'Cámara del dispositivo abierta en el PC'
      : 'Pantalla del dispositivo proyectándose en el PC',
  });
}

export async function checkOrStopScreen(ctx: ActionContext, action: 'check_screen' | 'stop_screen') {
  const streamLockFile = getLockFile(ctx.targetSerial || 'default');

  if (!fs.existsSync(streamLockFile)) {
    return NextResponse.json({ success: true, alive: false, reason: 'La transmisión no está activa' });
  }

  const alive = await isLockAlive(streamLockFile, 'scrcpy');

  if (action === 'stop_screen' && alive) {
    await killLockedProcess(streamLockFile);
    return NextResponse.json({ success: true, alive: false, message: 'Transmisión detenida' });
  }

  if (!alive) deleteLock(streamLockFile);
  return NextResponse.json({
    success: true, alive,
    reason: alive ? undefined : 'El motor de transmisión se cerró',
  });
}

// ── Screenshot ─────────────────────────────────────────────────────
/** Minimum valid screenshot size to detect FLAG_SECURE captures */
const MIN_SCREENSHOT_SIZE = 10240;

function validateScreenshotFile(localPath: string): number | null {
  try {
    const stats = fs.statSync(localPath);
    return stats.size >= MIN_SCREENSHOT_SIZE ? stats.size : null;
  } catch { return null; }
}

function removeLocalFile(localPath: string): void {
  try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch { /* ignore */ }
}

export async function screenshot(ctx: ActionContext) {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const devicePath = `/sdcard/screenshot_${timestamp}.png`;
  const altDevicePath = `/data/local/tmp/screenshot_${timestamp}.png`;
  const localPath = path.join(SCREENSHOTS_DIR, `screenshot_${timestamp}.png`);

  // Method 1 (preferred): exec-out pipes PNG directly to PC
  const r1 = await safeExec(`${ctx.adbTarget} exec-out screencap -p > "${localPath}"`, 15000);
  const size1 = validateScreenshotFile(localPath);
  if (size1 !== null) {
    return NextResponse.json({ success: true, message: 'Captura guardada en Capturas\\', path: localPath, size: size1 });
  }
  removeLocalFile(localPath);
  if (!r1.ok) console.error('[screenshot] exec-out falló:', r1.err?.trim() || '(sin stderr)');

  // Method 2: file-based via /sdcard
  const r2 = await safeExec(`${ctx.adbTarget} shell screencap -p "${devicePath}"`, 15000);
  if (r2.ok) {
    await safeExec(`${ctx.adbTarget} pull "${devicePath}" "${localPath}"`, 15000);
    await safeExec(`${ctx.adbTarget} shell rm -f "${devicePath}"`);
    const size2 = validateScreenshotFile(localPath);
    if (size2 !== null) {
      return NextResponse.json({ success: true, message: 'Captura guardada en Capturas\\', path: localPath, size: size2 });
    }
    removeLocalFile(localPath);
  }

  // Method 3: file-based via /data/local/tmp
  const r3 = await safeExec(`${ctx.adbTarget} shell screencap -p "${altDevicePath}"`, 15000);
  if (r3.ok) {
    await safeExec(`${ctx.adbTarget} pull "${altDevicePath}" "${localPath}"`, 15000);
    await safeExec(`${ctx.adbTarget} shell rm -f "${altDevicePath}"`);
    const size3 = validateScreenshotFile(localPath);
    if (size3 !== null) {
      return NextResponse.json({ success: true, message: 'Captura guardada en Capturas\\', path: localPath, size: size3 });
    }
    removeLocalFile(localPath);
  } else {
    await safeExec(`${ctx.adbTarget} shell rm -f "${altDevicePath}"`);
  }

  const details = [r1, r2, r3]
    .filter(r => !r.ok && r.err?.trim())
    .map(r => r.err!.trim())
    .join(' | ');

  return NextResponse.json({
    success: false,
    error: 'No se pudo capturar la pantalla con ningún método.',
    hint: 'Verificá que: (1) el dispositivo esté conectado, (2) la pantalla esté encendida, (3) no haya una app con FLAG_SECURE en primer plano.',
    detail: details || 'Sin diagnóstico adicional',
  }, { status: 422 });
}

// ── Video Recording ────────────────────────────────────────────────

export async function startRecord(ctx: ActionContext, body: { videoSource?: string }) {
  const targetSerial = ctx.targetSerial || 'default';
  const recordLockFile = getRecordLockFile(targetSerial);

  const stillRunning = await isLockAlive(recordLockFile);
  if (stillRunning) {
    return NextResponse.json({ success: false, error: 'Ya hay una grabación en curso para este dispositivo' });
  }
  deleteLock(recordLockFile);

  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const recordPath = path.join(SCREENSHOTS_DIR, `grabacion_${timestamp}.mp4`);

  const recordArgs: string[] = [];
  if (ctx.targetSerial) recordArgs.push('-s', String(ctx.targetSerial));
  recordArgs.push(
    '--video-codec', 'h265', '-b', '128M', '--max-fps', '60', '--max-size', '0',
    '--audio-codec', 'opus', '--audio-bit-rate', '192k', '--audio-buffer', '4',
    '--no-window', '--record', recordPath,
  );
  if (body.videoSource === 'camera') {
    recordArgs.push('--video-source', 'camera', '--no-audio');
  }

  const proc = spawn(ANDROPROJECT_BIN, recordArgs, {
    cwd: ANDROPROJECT_HOME,
    env: { ...process.env, ADB, SCRCPY_SERVER_PATH, SCRCPY_ICON_PATH },
    windowsHide: true,
  });

  if (proc.pid) {
    writeLock(recordLockFile, { pid: proc.pid, serial: targetSerial, path: recordPath });
    const cleanup = () => { deleteLock(recordLockFile); };
    proc.on('exit', cleanup);
    proc.on('error', cleanup);
  }

  return NextResponse.json({
    success: true, message: 'Grabación silenciosa iniciada',
    recordPath,
  });
}

export async function stopRecord(ctx: ActionContext) {
  const targetSerial = ctx.targetSerial || 'default';
  const recordLockFile = getRecordLockFile(targetSerial);
  let recordedPath: string | null = null;

  if (fs.existsSync(recordLockFile)) {
    const lock = readLock(recordLockFile);
    recordedPath = (lock as any)?.path || null;
    await killLockedProcess(recordLockFile);
  }

  return NextResponse.json({
    success: true,
    message: recordedPath ? `Grabación guardada: ${path.basename(recordedPath)}` : 'Grabación detenida',
    recordPath: recordedPath,
  });
}
