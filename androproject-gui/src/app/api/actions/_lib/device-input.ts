// ============================================================================
// ARCHIVO: device-input.ts
// QUÉ HACE: Maneja inyección de texto, portapapeles, gestos táctiles (tap/swipe)
//           y consola ADB interactiva con filtrado de comandos destructivos.
// CÓMO FUNCIONA: Unifica la inyección de texto/portapapeles en un helper común
//           (AirPlay en iOS o `cmd clipboard set` + fallback ASCII en Android)
//           y valida coordenadas antes de enviarlas por ADB/AirPlay.
// POR QUÉ: Extraer entrada/shell de device.ts elimina código duplicado y
//           mantiene ambos archivos por debajo de 200 líneas (SRP / DRY).
// ============================================================================

import { NextResponse } from 'next/server';
import { adb } from '@/lib/services/adb-executor';
import type { ActionContext } from './context';

const isIosSerial = (serial: string) =>
  serial.startsWith('airplay-') || serial.startsWith('apple-');

const isValidPoint = (v: unknown): v is number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 10000;
};

/** Helper compartido para enviar texto por AirPlay, portapapeles ADB o input text ASCII. */
async function sendTextViaClipboardOrAscii(
  target: string,
  text: string,
  pasteAfterSet: boolean,
): Promise<{ success: boolean; message: string }> {
  if (isIosSerial(target)) {
    const { airPlayReceiverEngine } = await import('@/lib/services/airplay-engine');
    const res = await airPlayReceiverEngine.injectText(text);
    return { success: Boolean(res?.success), message: res?.message || 'Texto enviado a iOS' };
  }

  const hasUnicodeOrNewline = /[^\x20-\x7E]|\n|\r/.test(text);
  if (!pasteAfterSet || hasUnicodeOrNewline || text.length > 60) {
    const escapedSh = text.replace(/'/g, "'\\''");
    const clipRes = await adb.shell(target, `cmd clipboard set '${escapedSh}'`);
    if (clipRes.ok) {
      if (pasteAfterSet) await adb.shell(target, 'input keyevent 279');
      return {
        success: true,
        message: pasteAfterSet ? 'Texto inyectado fielmente vía portapapeles' : 'Portapapeles sincronizado con Android',
      };
    }
  }

  const escaped = text.replace(/([\\$`"!\s])/g, (char) => (char === ' ' ? '%s' : `\\${char}`));
  await adb.shell(target, `input text "${escaped}"`);
  return { success: true, message: 'Texto enviado al dispositivo' };
}

export async function inputText(ctx: ActionContext, body: { text: string }) {
  if (!body.text || typeof body.text !== 'string') {
    return NextResponse.json({ success: false, error: 'Texto requerido' }, { status: 400 });
  }
  const target = ctx.targetSerial || '';
  if (!target) {
    return NextResponse.json({ success: false, error: 'Serial de dispositivo requerido' }, { status: 400 });
  }
  return NextResponse.json(await sendTextViaClipboardOrAscii(target, body.text, true));
}

export async function setClipboard(ctx: ActionContext, body: { text: string }) {
  if (typeof body.text !== 'string') {
    return NextResponse.json({ success: false, error: 'Texto requerido' }, { status: 400 });
  }
  const target = ctx.targetSerial || '';
  if (!target) {
    return NextResponse.json({ success: false, error: 'Serial de dispositivo requerido' }, { status: 400 });
  }
  return NextResponse.json(await sendTextViaClipboardOrAscii(target, body.text, false));
}

export async function pasteClipboard(ctx: ActionContext, body: { text?: string }) {
  const target = ctx.targetSerial || '';
  if (!target) {
    return NextResponse.json({ success: false, error: 'Serial de dispositivo requerido' }, { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text : '';

  if (target.startsWith('airplay-')) {
    if (!text) return NextResponse.json({ success: false, error: 'Texto no proporcionado' }, { status: 400 });
    const { airPlayReceiverEngine } = await import('@/lib/services/airplay-engine');
    return NextResponse.json(await airPlayReceiverEngine.injectText(text));
  }

  if (text) {
    const escapedSh = text.replace(/'/g, "'\\''");
    await adb.shell(target, `cmd clipboard set '${escapedSh}'`);
  }
  await adb.shell(target, 'input keyevent 279');
  return NextResponse.json({
    success: true,
    message: text ? 'Texto pegado en el dispositivo' : 'Comando Pegar ejecutado',
  });
}

export async function inputTap(ctx: ActionContext, body: { x: number; y: number }) {
  const x = typeof body.x === 'number' ? body.x : parseFloat(String(body.x));
  const y = typeof body.y === 'number' ? body.y : parseFloat(String(body.y));
  if (!isValidPoint(x) || !isValidPoint(y)) {
    return NextResponse.json({ success: false, error: 'Coordenadas de tap inválidas' }, { status: 400 });
  }

  const target = ctx.targetSerial || '';
  if (!target) {
    return NextResponse.json({ success: false, error: 'Serial de dispositivo requerido' }, { status: 400 });
  }
  if (isIosSerial(target)) {
    const { airPlayReceiverEngine } = await import('@/lib/services/airplay-engine');
    return NextResponse.json(await airPlayReceiverEngine.injectTap(Math.round(x), Math.round(y)));
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

  const target = ctx.targetSerial || '';
  if (!target) {
    return NextResponse.json({ success: false, error: 'Serial de dispositivo requerido' }, { status: 400 });
  }
  const duration = Math.max(20, Math.min(5000, Math.round(Number(body.duration ?? 120))));
  if (isIosSerial(target)) {
    const { airPlayReceiverEngine } = await import('@/lib/services/airplay-engine');
    return NextResponse.json(
      await airPlayReceiverEngine.injectSwipe(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2), duration),
    );
  }

  await adb.shell(target, `input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${duration}`);
  return NextResponse.json({ success: true, message: 'Gesto enviado' });
}

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

  cmd = cmd.trim();
  if (cmd.startsWith('adb shell ')) cmd = cmd.slice(10).trim();
  else if (cmd.startsWith('adb ')) cmd = cmd.slice(4).trim();

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(cmd)) {
      return NextResponse.json({ success: false, error: `Comando bloqueado por seguridad: ${cmd.slice(0, 40)}` }, { status: 403 });
    }
  }

  if (!ctx.targetSerial) {
    return NextResponse.json({ success: false, error: 'No hay dispositivo seleccionado o conectado para ejecutar el shell' }, { status: 400 });
  }

  const result = await adb.shell(ctx.targetSerial, cmd, 15000);
  const cleanAnsi = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  const out = cleanAnsi(result.out || '');
  const err = cleanAnsi(result.err || '');

  if (!result.ok && !out) {
    return NextResponse.json({ success: false, error: err || 'Sin respuesta del dispositivo', output: '' });
  }
  return NextResponse.json({ success: true, output: out || err || '(sin salida)' });
}
