// ============================================================================
// ARCHIVO: stream.ts
// QUÉ HACE: Endpoints de transmisión de pantalla (open_screen, check_screen,
//           stop_screen), capturas PNG (screenshot) y re-exportación de
//           grabación MP4 desde stream-recorder.ts.
// CÓMO FUNCIONA: Resuelve `IProjectionCoordinator` e `IScreenCapture` mediante
//           el contenedor IoC (`ServiceContainer`), capturando PNGs en 3 niveles
//           (`exec-out`, `/sdcard`, `/data/local/tmp`) o desde AirPlay 2.
// POR QUÉ: Conectar `ServiceContainer` y `ScreenCapture` bajo DIP/SRP (< 200L).
// ============================================================================

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { ActionContext } from './_lib/context';
import { SCREENSHOTS_DIR } from '@/lib/config';
import { container, TOKENS } from '@/core/container/ServiceContainer';
import type { IProjectionCoordinator } from '@/lib/services/projection-coordinator';
import type { IScreenCapture } from '@/lib/services/screen-capture';
import type { DeviceInfo } from '@/features/types';
import { airPlayReceiverEngine } from '@/lib/services/airplay-engine';
import { isValidDeviceSerial } from '@/lib/security/input-sanitizer';

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
  enableAudio?: boolean;
  platform?: 'android' | 'ios';
}) {
  const targetSerial = ctx.targetSerial?.trim() || (body.platform === 'ios' ? 'airplay-ios' : '');
  if (!isValidDeviceSerial(targetSerial)) {
    return NextResponse.json({ success: false, error: 'No hay un dispositivo conectado' }, { status: 400 });
  }

  const isIos = /^(airplay|apple)-/.test(targetSerial) || body.platform === 'ios';
  const device: DeviceInfo = {
    serial: targetSerial,
    model: isIos ? 'Apple iPhone' : 'Android Device',
    platform: isIos ? 'ios' : 'android',
    connected: true,
  };

  const coordinator = container.resolve<IProjectionCoordinator>(TOKENS.ProjectionCoordinator);
  const result = await coordinator.start(device, {
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
    noAudio: body.enableAudio !== true,
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
  const serial = ctx.targetSerial?.trim();
  if (!isValidDeviceSerial(serial)) return NextResponse.json({ success: true, alive: false, sessions: [] });
  const isIos = /^(airplay|apple)-/.test(serial);
  const device: DeviceInfo = {
    serial,
    model: isIos ? 'Apple iPhone' : 'Android Device',
    platform: isIos ? 'ios' : 'android',
    connected: true,
  };

  const coordinator = container.resolve<IProjectionCoordinator>(TOKENS.ProjectionCoordinator);
  if (action === 'check_screen') {
    const alive = await coordinator.isAlive(device);
    return NextResponse.json({ success: true, alive, sessions: coordinator.getActiveSessions() });
  }

  if (action === 'stop_screen') {
    const stopped = await coordinator.stop(device);
    const alive = await coordinator.isAlive(device);
    if (alive) return NextResponse.json({ success: false, alive: true, error: 'Una sesión de pantalla sigue activa. Intenta cerrarla de nuevo.' }, { status: 500 });
    return NextResponse.json({
      success: true,
      alive: false,
      message: stopped ? 'Transmisión detenida correctamente' : 'No había transmisión activa',
    });
  }

  return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
}

/** Captura una imagen PNG de alta resolución (AirPlay frame o 3-tier ADB ScreenCapture). */
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

  const captureSvc = container.resolve<IScreenCapture>(TOKENS.ScreenCapture);
  const captured = await captureSvc.capture(serial);
  if (captured.ok && captured.data && captured.data.byteLength >= MIN_SCREENSHOT_SIZE) {
    fs.writeFileSync(localPath, captured.data);
    return NextResponse.json({
      success: true,
      message: `Captura guardada en Capturas\\screenshot_${timestamp}.png`,
      path: localPath,
      size: captured.data.byteLength,
    });
  }

  return NextResponse.json({
    success: false,
    error: captured.error || 'No se pudo capturar la pantalla. Verifica que el dispositivo esté desbloqueado.',
  }, { status: 422 });
}
