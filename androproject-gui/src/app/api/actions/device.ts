/**
 * Device action handlers.
 * SOLID: SRP (each function does one thing), DIP (uses service interfaces).
 */
import { NextResponse } from 'next/server';
import { adb } from '@/lib/services/adb-executor';
import { ActionContext } from './_lib/context';

// ── ADB Lifecycle ──────────────────────────────────────────────────

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
  if (!body.serial) {
    return NextResponse.json({ success: false, error: 'Serial requerido' }, { status: 400 });
  }
  const { ok } = await adb.exec(`disconnect ${body.serial}`, 10000);
  return NextResponse.json({ success: ok, message: ok ? `Desconectado ${body.serial}` : 'Error al desconectar' });
}

// ── Reboot / Power ─────────────────────────────────────────────────

export async function reboot(ctx: ActionContext) {
  await adb.execFor(ctx.targetSerial!, 'reboot');
  return NextResponse.json({ success: true, message: 'Reiniciando dispositivo...' });
}

export async function rebootBootloader(ctx: ActionContext) {
  await adb.execFor(ctx.targetSerial!, 'reboot bootloader');
  return NextResponse.json({ success: true, message: 'Reiniciando en modo Bootloader...' });
}

export async function rebootRecovery(ctx: ActionContext) {
  await adb.execFor(ctx.targetSerial!, 'reboot recovery');
  return NextResponse.json({ success: true, message: 'Reiniciando en modo Recovery...' });
}

export async function powerOff(ctx: ActionContext) {
  await adb.shell(ctx.targetSerial!, 'reboot -p');
  return NextResponse.json({ success: true, message: 'Apagando dispositivo...' });
}

// ── Foreground App / Input ─────────────────────────────────────────

export async function getForegroundApp(ctx: ActionContext) {
  const [windowResult, activityResult] = await Promise.all([
    adb.execFor(ctx.targetSerial!, 'shell dumpsys window windows'),
    adb.execFor(ctx.targetSerial!, 'shell dumpsys activity activities'),
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
  await adb.shell(ctx.targetSerial!, `input keyevent ${body.keycode}`);
  return NextResponse.json({ success: true, message: `Tecla enviada: ${body.keycode}` });
}

// ── Touch input synthesis ──────────────────────────────────────────

function isValidPoint(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10000;
}

export async function inputTap(ctx: ActionContext, body: { x: number; y: number }) {
  const { x, y } = body;
  if (!isValidPoint(x) || !isValidPoint(y)) {
    return NextResponse.json({ success: false, error: 'Coordenadas de tap invalidas' }, { status: 400 });
  }
  await adb.shell(ctx.targetSerial!, `input tap ${Math.round(x)} ${Math.round(y)}`);
  return NextResponse.json({ success: true, message: `Tap en (${Math.round(x)}, ${Math.round(y)})` });
}

export async function inputSwipe(
  ctx: ActionContext,
  body: { x1: number; y1: number; x2: number; y2: number; duration?: number },
) {
  const { x1, y1, x2, y2 } = body;
  if (![x1, y1, x2, y2].every(isValidPoint)) {
    return NextResponse.json({ success: false, error: 'Coordenadas de swipe invalidas' }, { status: 400 });
  }
  const duration = Math.max(0, Math.min(5000, Math.round(body.duration ?? 120)));
  await adb.shell(ctx.targetSerial!, `input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${duration}`);
  return NextResponse.json({ success: true, message: 'Gesto enviado' });
}

// ── Interactive ADB Shell ──────────────────────────────────────────

const BLOCKED_PATTERNS = [
  /rm\s+-rf?\s+\/(?!\s*(data|sdcard|cache|tmp))/i,
  /mkfs/i,
  /dd\s+.*of=\/dev\/block/i,
  /fastboot\s+erase/i,
];

export async function adbShell(ctx: ActionContext, body: { cmd: string }) {
  const { cmd } = body;
  if (!cmd || typeof cmd !== 'string' || cmd.length > 512) {
    return NextResponse.json({ success: false, error: 'Comando invalido o demasiado largo' }, { status: 400 });
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(cmd)) {
      return NextResponse.json({ success: false, error: `Comando bloqueado por seguridad: ${cmd.slice(0, 40)}` }, { status: 403 });
    }
  }
  const result = await adb.shell(ctx.targetSerial!, cmd, 15000);
  if (!result.ok && !result.out) {
    return NextResponse.json({ success: false, error: result.err || 'Sin respuesta del dispositivo', output: '' });
  }
  return NextResponse.json({ success: true, output: (result.out || '') + (result.err && !result.out ? result.err : '') });
}
