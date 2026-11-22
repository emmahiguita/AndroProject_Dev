// ============================================================================
// ARCHIVO: device.ts
// QUÉ HACE: Endpoints de ciclo de vida ADB, energía (reboot/powerOff),
//           detección de app en primer plano y envío seguro de keyevents.
// CÓMO FUNCIONA: Valida estrictamente seriales y keycodes antes de invocar
//           `adb.exec`/`adb.shell` para prevenir inyección de comandos, y
//           re-exporta las acciones de entrada desde `_lib/device-input.ts`.
// POR QUÉ: Mantener este módulo < 200 líneas (SRP) y cerrar vectores de
//           inyección en `disconnectDevice` y `keyevent`.
// ============================================================================

import { NextResponse } from 'next/server';
import { adb } from '@/lib/services/adb-executor';
import { ActionContext } from './_lib/context';

export {
  inputText,
  setClipboard,
  pasteClipboard,
  inputTap,
  inputSwipe,
  adbShell,
} from './_lib/device-input';

const SAFE_SERIAL_RE = /^[a-zA-Z0-9._:-]+$/;
const SAFE_KEYCODE_RE = /^[A-Z0-9_]{1,48}$/i;

export async function restartAdb() {
  await adb.exec('kill-server');
  await adb.exec('start-server');
  return NextResponse.json({ success: true, message: 'ADB reiniciado correctamente' });
}

export async function startAdbServer() {
  const { ok, out, err } = await adb.exec('start-server', 10000);
  return NextResponse.json({
    success: ok,
    message: ok ? 'Servidor ADB iniciado' : (err || 'Error al iniciar servidor ADB'),
    output: out,
  });
}

export async function stopAdbServer() {
  const { ok, out, err } = await adb.exec('kill-server', 10000);
  return NextResponse.json({
    success: ok,
    message: ok ? 'Servidor ADB detenido' : (err || 'Error al detener servidor ADB'),
    output: out,
  });
}

export async function getAdbStatus() {
  const devices = await adb.exec('devices -l', 5000);
  if (!devices.ok) {
    return NextResponse.json({ success: false, serverRunning: false, devices: [] });
  }

  const lines = devices.out.trim().split('\n').slice(1);
  const result: Array<{ serial: string; state: string; model: string; connectionType: string }> = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const serial = parts[0];
    const state = parts[1];
    if (!['device', 'offline', 'unauthorized', 'recovery', 'sideload'].includes(state)) continue;

    let model = 'Dispositivo';
    const modelMatch = line.match(/model:(\S+)/);
    if (modelMatch) model = modelMatch[1].replace(/_/g, ' ');

    const isWifi = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\b/.test(serial);
    result.push({ serial, state, model, connectionType: isWifi ? 'Wi-Fi' : 'USB' });
  }

  return NextResponse.json({
    success: true,
    serverRunning: true,
    devices: result,
    deviceCount: result.length,
  });
}

export async function disconnectDevice(body: { serial?: string; all?: boolean }) {
  if (body.all) {
    const { ok } = await adb.exec('disconnect', 10000);
    return NextResponse.json({ success: ok, message: ok ? 'Todos los dispositivos Wi-Fi desconectados' : 'Error al desconectar' });
  }
  const serial = String(body.serial || '').trim();
  if (!serial || !SAFE_SERIAL_RE.test(serial)) {
    return NextResponse.json({ success: false, error: 'Serial requerido o con formato inválido' }, { status: 400 });
  }
  const { ok } = await adb.exec(`disconnect ${serial}`, 10000);
  return NextResponse.json({ success: ok, message: ok ? `Desconectado ${serial}` : 'Error al desconectar' });
}

export async function reboot(ctx: ActionContext) {
  if (!ctx.targetSerial) {
    return NextResponse.json({ success: false, error: 'Se requiere serial de dispositivo para reiniciar' }, { status: 400 });
  }
  await adb.execFor(ctx.targetSerial, 'reboot');
  return NextResponse.json({ success: true, message: 'Reiniciando dispositivo...' });
}

export async function rebootBootloader(ctx: ActionContext) {
  if (!ctx.targetSerial) {
    return NextResponse.json({ success: false, error: 'Se requiere serial de dispositivo' }, { status: 400 });
  }
  await adb.execFor(ctx.targetSerial, 'reboot bootloader');
  return NextResponse.json({ success: true, message: 'Reiniciando en modo Bootloader...' });
}

export async function rebootRecovery(ctx: ActionContext) {
  if (!ctx.targetSerial) {
    return NextResponse.json({ success: false, error: 'Se requiere serial de dispositivo' }, { status: 400 });
  }
  await adb.execFor(ctx.targetSerial, 'reboot recovery');
  return NextResponse.json({ success: true, message: 'Reiniciando en modo Recovery...' });
}

export async function powerOff(ctx: ActionContext) {
  if (!ctx.targetSerial) {
    return NextResponse.json({ success: false, error: 'Se requiere serial de dispositivo' }, { status: 400 });
  }
  await adb.shell(ctx.targetSerial, 'reboot -p');
  return NextResponse.json({ success: true, message: 'Apagando dispositivo...' });
}

export async function getForegroundApp(ctx: ActionContext) {
  const target = ctx.targetSerial || '';
  if (target.startsWith('airplay-') || target.startsWith('apple-')) {
    const { iosBridge } = await import('@/lib/services/ios-bridge');
    const app = await iosBridge.getActiveApp();
    if (app.success && app.bundleId) {
      return NextResponse.json({ success: true, package: app.bundleId });
    }
    return NextResponse.json({ success: true, package: 'com.apple.springboard' });
  }
  if (!target) {
    return NextResponse.json({ success: false, error: 'Se requiere serial de dispositivo' }, { status: 400 });
  }

  const [windowResult, activityResult] = await Promise.all([
    adb.execFor(target, 'shell dumpsys window windows'),
    adb.execFor(target, 'shell dumpsys activity activities'),
  ]);
  const output = `${windowResult.out || ''}\n${activityResult.out || ''}`;
  const match =
    output.match(/mCurrentFocus=.*?\s([A-Za-z0-9._]+)\/[A-Za-z0-9.$_]+/) ||
    output.match(/mResumedActivity:.*?\s([A-Za-z0-9._]+)\/[A-Za-z0-9.$_]+/) ||
    output.match(/topResumedActivity=.*?\s([A-Za-z0-9._]+)\/[A-Za-z0-9.$_]+/);

  if ((!windowResult.ok && !activityResult.ok) || !match?.[1]) {
    return NextResponse.json({ success: false, error: 'No se pudo identificar la aplicacion activa' });
  }
  return NextResponse.json({ success: true, package: match[1] });
}

export async function keyevent(ctx: ActionContext, body: { keycode: string }) {
  const target = ctx.targetSerial || '';
  if (!target) {
    return NextResponse.json({ success: false, error: 'Se requiere serial de dispositivo' }, { status: 400 });
  }

  const code = String(body.keycode || '').trim();
  if (!SAFE_KEYCODE_RE.test(code)) {
    return NextResponse.json({ success: false, error: 'Keycode inválido' }, { status: 400 });
  }

  if (target.startsWith('airplay-') || target.startsWith('apple-')) {
    const { iosBridge } = await import('@/lib/services/ios-bridge');
    const upper = code.toUpperCase();
    if (upper.includes('HOME')) return NextResponse.json(await iosBridge.pressButton('home'));
    if (upper.includes('POWER') || upper.includes('LOCK')) return NextResponse.json(await iosBridge.pressButton('lock'));
    if (upper.includes('VOLUME_UP')) return NextResponse.json(await iosBridge.pressButton('volumeUp'));
    if (upper.includes('VOLUME_DOWN')) return NextResponse.json(await iosBridge.pressButton('volumeDown'));
    if (upper.includes('BACK')) {
      await iosBridge.swipe(10, 500, 250, 500, 150);
      return NextResponse.json({ success: true, message: 'Gesto Atrás iOS ejecutado' });
    }
    return NextResponse.json({ success: true, message: `Tecla iOS simulada: ${code}` });
  }

  await adb.shell(target, `input keyevent ${code}`);
  return NextResponse.json({ success: true, message: `Tecla enviada: ${code}` });
}
