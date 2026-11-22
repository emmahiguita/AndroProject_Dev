// ============================================================================
// ARCHIVO: stream.ts
// QUÉ HACE: Endpoints de transmisión de pantalla (open_screen, check_screen,
//           stop_screen), capturas PNG (screenshot) y re-exportación de
//           grabación MP4 desde stream-recorder.ts.
// CÓMO FUNCIONA: Enruta la proyección al ProjectionCoordinator (Android scrcpy
//           o iOS AirPlay 2) y captura PNGs desde AirPlay o adb screencap.
// POR QUÉ: Mantener las rutas de streaming y captura separadas de la lógica
//           de grabación conserva cada archivo por debajo de 200 líneas.
// ============================================================================

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { ActionContext } from './_lib/context';
import { SCREENSHOTS_DIR } from '@/lib/config';
import { projectionCoordinator } from '@/lib/services/projection-coordinator';
import type { DeviceInfo } from '@/features/types';
import { adb } from '@/lib/services/adb-executor';
import { airPlayReceiverEngine } from '@/lib/services/airplay-engine';

export { startRecord, stopRecord, checkRecord } from './_lib/stream-recorder';

const MIN_SCREENSHOT_SIZE = 1024;

/** Inicia la proyección nativa (VisionNano Android o AirPlay 2 iOS). */
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
  platform?: 'android' | 'ios';
}) {
  const targetSerial = ctx.targetSerial || (body.platform === 'ios' ? 'airplay-ios' : '');
  if (!targetSerial) {
    return NextResponse.json({ success: false, error: 'No hay un dispositivo conectado' }, { status: 400 });
  }

  const isIos = (targetSerial && targetSerial.startsWith('airplay-')) || body.platform === 'ios';
  const device: DeviceInfo = {
    serial: targetSerial,
    model: isIos ? 'Apple iPhone' : 'Android Device',
    platform: isIos ? 'ios' : 'android',
    connected: true,
  };

  const result = await projectionCoordinator.start(device, {
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
    platform: device.platform,
  });

  const isSuccess = 'success' in result ? result.success : ('running' in result ? result.running : true);
  if (!isSuccess) {
    const errorMsg = ('error' in result && result.error) || 'Error al iniciar transmisión';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }

  return NextResponse.json(result);
}

/** Verifica si la transmisión sigue activa o la detiene limpiamente. */
export async function checkOrStopScreen(ctx: ActionContext, action: 'check_screen' | 'stop_screen') {
  const serial = ctx.targetSerial || 'default';
  const isIos = serial.startsWith('airplay-');
  const device: DeviceInfo = {
    serial,
    model: isIos ? 'Apple iPhone' : 'Android Device',
    platform: isIos ? 'ios' : 'android',
    connected: true,
  };

  if (action === 'check_screen') {
    const alive = await projectionCoordinator.isAlive(device);
    return NextResponse.json({ success: true, alive });
  }

  if (action === 'stop_screen') {
    const stopped = await projectionCoordinator.stop(device);
    return NextResponse.json({
      success: true,
      alive: false,
      message: stopped ? 'Transmisión detenida correctamente' : 'No había transmisión activa',
    });
  }

  return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
}

/** Captura una imagen PNG de alta resolución (AirPlay frame o ADB screencap). */
export async function screenshot(ctx: ActionContext) {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const localPath = path.join(SCREENSHOTS_DIR, `screenshot_${timestamp}.png`);
  const serial = ctx.targetSerial || '';

  if (serial.startsWith('airplay-') || serial.startsWith('apple-')) {
    const frame = airPlayReceiverEngine.getLatestFrame(serial);
    if (frame && frame.length > MIN_SCREENSHOT_SIZE && frame[0] === 0x89 && frame[1] === 0x50) {
      fs.writeFileSync(localPath, frame);
      return NextResponse.json({
        success: true,
        message: `Captura iOS guardada en Capturas\\screenshot_${timestamp}.png`,
        path: localPath,
        size: frame.length,
      });
    }
    return NextResponse.json({
      success: false,
      error: 'No se pudo capturar la pantalla iOS. Verifica que la duplicación AirPlay esté activa en tu iPhone.',
    }, { status: 422 });
  }

  if (!serial) {
    return NextResponse.json({ success: false, error: 'No hay un dispositivo conectado' }, { status: 400 });
  }

  // Método primario: binario directo por exec-out sin escribir en el almacenamiento interno
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

  // Método respaldo: capturar en /sdcard y extraer por adb pull
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
