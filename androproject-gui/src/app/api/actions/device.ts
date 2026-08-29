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
  // FIX BUG#14: guard explicito — nunca ejecutar sin serial (afectaria todos los dispositivos)
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

// ── Touch input / text synthesis ───────────────────────────────────

export async function inputText(ctx: ActionContext, body: { text: string }) {
  const { text } = body;
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ success: false, error: 'Texto requerido' }, { status: 400 });
  }

  const target = ctx.targetSerial || '';
  if (target.startsWith('airplay-')) {
    const { airPlayReceiverEngine } = await import('@/lib/services/airplay-engine');
    const res = await airPlayReceiverEngine.injectText(text);
    return NextResponse.json(res);
  }

  // Escape shell characters and spaces for adb shell input text
  const escaped = text.replace(/([\\$`"!\s])/g, (char) => (char === ' ' ? '%s' : `\\${char}`));
  await adb.shell(target, `input text "${escaped}"`);
  return NextResponse.json({ success: true, message: 'Texto enviado al dispositivo' });
}

function isValidPoint(v: unknown): v is number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 10000;
}

export async function inputTap(ctx: ActionContext, body: { x: number; y: number }) {
  const x = typeof body.x === 'number' ? body.x : parseFloat(String(body.x));
  const y = typeof body.y === 'number' ? body.y : parseFloat(String(body.y));
  if (!isValidPoint(x) || !isValidPoint(y)) {
    return NextResponse.json({ success: false, error: 'Coordenadas de tap inválidas' }, { status: 400 });
  }

  const target = ctx.targetSerial || '';
  if (target.startsWith('airplay-')) {
    const { airPlayReceiverEngine } = await import('@/lib/services/airplay-engine');
    const res = await airPlayReceiverEngine.injectTap(Math.round(x), Math.round(y));
    return NextResponse.json(res);
  }

  await adb.shell(target, `input tap ${Math.round(x)} ${Math.round(y)}`);
  return NextResponse.json({ success: true, message: `Tap en (${Math.round(x)}, ${Math.round(y)})` });
}

export async function inputSwipe(
  ctx: ActionContext,
  body: { x1: number; y1: number; x2: number; y2: number; duration?: number },
) {
  const x1 = typeof body.x1 === 'number' ? body.x1 : parseFloat(String(body.x1));
  const y1 = typeof body.y1 === 'number' ? body.y1 : parseFloat(String(body.y1));
  const x2 = typeof body.x2 === 'number' ? body.x2 : parseFloat(String(body.x2));
  const y2 = typeof body.y2 === 'number' ? body.y2 : parseFloat(String(body.y2));
  if (![x1, y1, x2, y2].every(isValidPoint)) {
    return NextResponse.json({ success: false, error: 'Coordenadas de swipe inválidas' }, { status: 400 });
  }

  const duration = Math.max(20, Math.min(5000, Math.round(Number(body.duration ?? 120))));
  const target = ctx.targetSerial || '';
  if (target.startsWith('airplay-')) {
    const { airPlayReceiverEngine } = await import('@/lib/services/airplay-engine');
    const res = await airPlayReceiverEngine.injectSwipe(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2), duration);
    return NextResponse.json(res);
  }

  await adb.shell(target, `input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${duration}`);
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
  let { cmd } = body;
  if (!cmd || typeof cmd !== 'string' || cmd.length > 1024) {
    return NextResponse.json({ success: false, error: 'Comando inválido o demasiado largo' }, { status: 400 });
  }

  // Normalizar: si el usuario escribe "adb shell ..." o "adb ...", remover prefijo
  cmd = cmd.trim();
  if (cmd.startsWith('adb shell ')) {
    cmd = cmd.slice(10).trim();
  } else if (cmd.startsWith('adb ')) {
    cmd = cmd.slice(4).trim();
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(cmd)) {
      return NextResponse.json({ success: false, error: `Comando bloqueado por seguridad: ${cmd.slice(0, 40)}` }, { status: 403 });
    }
  }

  if (!ctx.targetSerial) {
    return NextResponse.json({ success: false, error: 'No hay dispositivo seleccionado o conectado para ejecutar el shell' }, { status: 400 });
  }

  const result = await adb.shell(ctx.targetSerial, cmd, 15000);

  // Limpiar secuencias de escape ANSI para evitar texto corrupto en la UI
  const cleanAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  const out = cleanAnsi(result.out || '');
  const err = cleanAnsi(result.err || '');

  if (!result.ok && !out) {
    return NextResponse.json({ success: false, error: err || 'Sin respuesta del dispositivo', output: '' });
  }
  return NextResponse.json({
    success: true,
    output: out || err || '(sin salida)',
  });
}

