import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ActionContext } from './_lib/context';
import {
  ANDROPROJECT_BIN, ANDROPROJECT_HOME, SCREENSHOTS_DIR, ADB,
  SCRCPY_SERVER_PATH, SCRCPY_ICON_PATH,
  getRecordLockFile,
  writeLock, readLock, deleteLock, isLockAlive, killLockedProcess,
} from '@/lib/config';
import { scrcpyEngine } from '@/lib/services/scrcpy-engine';
import { adb } from '@/lib/services/adb-executor';

// ── Screen Streaming (scrcpy) ──────────────────────────────────────

export async function openScreen(ctx: ActionContext, body: {
  videoSource?: string;
  displayId?: number | string;
  maxSize?: number | string;
  maxFps?: number | string;
  bitRate?: string;
  turnScreenOff?: boolean;
  stayAwake?: boolean;
  alwaysOnTop?: boolean;
  borderless?: boolean;
  videoBuffer?: number | string;
}) {
  const targetSerial = ctx.targetSerial;
  if (!targetSerial) {
    return NextResponse.json({ success: false, error: 'No hay un dispositivo Android conectado' }, { status: 400 });
  }

  const result = await scrcpyEngine.start({
    serial: targetSerial,
    displayId: body.displayId,
    maxSize: body.maxSize,
    maxFps: body.maxFps,
    bitRate: body.bitRate,
    turnScreenOff: body.turnScreenOff,
    stayAwake: body.stayAwake,
    alwaysOnTop: body.alwaysOnTop,
    borderless: body.borderless,
    videoBuffer: body.videoBuffer,
    videoSource: body.videoSource as 'display' | 'camera',
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Error al iniciar transmisión' }, { status: 500 });
  }

  return NextResponse.json(result);
}

export async function checkOrStopScreen(ctx: ActionContext, action: 'check_screen' | 'stop_screen') {
  const serial = ctx.targetSerial || 'default';

  if (serial.startsWith('airplay-')) {
    const { airPlayReceiverEngine } = await import('@/lib/services/airplay-engine');
    if (action === 'check_screen') {
      const status = await airPlayReceiverEngine.getStatus();
      return NextResponse.json({ success: true, alive: status.running });
    }
    if (action === 'stop_screen') {
      const stopped = await airPlayReceiverEngine.stop();
      return NextResponse.json({ success: true, alive: false, message: 'Transmisión AirPlay detenida' });
    }
  }

  if (action === 'check_screen') {
    const alive = await scrcpyEngine.checkAlive(serial);
    return NextResponse.json({ success: true, alive });
  }

  if (action === 'stop_screen') {
    const stopped = await scrcpyEngine.stop(serial);
    return NextResponse.json({
      success: true,
      alive: false,
      message: stopped ? 'Transmisión detenida correctamente' : 'No había transmisión activa',
    });
  }

  return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
}

// ── Screenshot ─────────────────────────────────────────────────────

const MIN_SCREENSHOT_SIZE = 1024;

export async function screenshot(ctx: ActionContext) {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const localPath = path.join(SCREENSHOTS_DIR, `screenshot_${timestamp}.png`);
  const serial = ctx.targetSerial || '';

  // Primary method: raw binary screencap via exec-out
  const res = await adb.execOut(serial, 'exec-out screencap -p');
  if (res.ok && res.stdout.length > MIN_SCREENSHOT_SIZE && res.stdout[0] === 0x89 && res.stdout[1] === 0x50) {
    fs.writeFileSync(localPath, res.stdout);
    return NextResponse.json({
      success: true,
      message: `Captura guardada en Capturas\\screenshot_${timestamp}.png`,
      path: localPath,
      size: res.stdout.length,
    });
  }

  // Fallback method: on-device /sdcard capture
  const devicePath = `/sdcard/screenshot_${timestamp}.png`;
  await adb.shell(serial, `screencap -p "${devicePath}"`);
  await adb.execFor(serial, `pull "${devicePath}" "${localPath}"`);
  await adb.shell(serial, `rm -f "${devicePath}"`);

  if (fs.existsSync(localPath)) {
    const stat = fs.statSync(localPath);
    if (stat.size >= MIN_SCREENSHOT_SIZE) {
      return NextResponse.json({
        success: true,
        message: `Captura guardada en Capturas\\screenshot_${timestamp}.png`,
        path: localPath,
        size: stat.size,
      });
    }
    try { fs.unlinkSync(localPath); } catch {}
  }

  return NextResponse.json({
    success: false,
    error: 'No se pudo capturar la pantalla. Verifica que el dispositivo esté desbloqueado.',
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
    '--video-codec=h264',
    '-b=16M',
    '--max-fps=60',
    '--max-size=0',
    '--no-playback',
    `--record=${recordPath}`,
  );
  if (body.videoSource === 'camera') {
    recordArgs.push('--video-source=camera', '--camera-facing=back', '--no-audio');
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
    success: true,
    message: 'Grabación MP4 iniciada',
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
