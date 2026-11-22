import { NextResponse } from 'next/server';
import { safeExec } from './_lib/helpers';
import { ActionContext } from './_lib/context';

// ── Animations ─────────────────────────────────────────────────────

interface ScaleMap { [key: string]: string }

const ALLOWED_ANIM_KEYS = new Set([
  'window_animation_scale',
  'transition_animation_scale',
  'animator_duration_scale',
]);
const SAFE_SCALE_RE = /^(?:0(?:\.\d+)?|[1-9]\d?(?:\.\d+)?)$/;

export async function setAnimationBatch(ctx: ActionContext, body: { scales: ScaleMap }) {
  const { scales } = body;
  const errors: string[] = [];
  for (const [k, v] of Object.entries(scales || {})) {
    if (!ALLOWED_ANIM_KEYS.has(k) || !SAFE_SCALE_RE.test(String(v).trim())) {
      errors.push(`${k}: valor o clave inválida`);
      continue;
    }
    const r = await safeExec(`${ctx.adbTarget} shell settings put global ${k} ${String(v).trim()}`);
    if (!r.ok) errors.push(`${k}: ${r.err}`);
  }
  return NextResponse.json({
    success: errors.length === 0,
    message: errors.length ? errors.join('; ') : 'Todas las animaciones aplicadas',
  });
}

export async function setAnimationScale(ctx: ActionContext, body: { type: string; value: string }) {
  const { type, value } = body;
  const keys: Record<string, string> = {
    window: 'window_animation_scale',
    transition: 'transition_animation_scale',
    animator: 'animator_duration_scale',
  };
  const key = keys[type];
  const safeVal = String(value ?? '').trim();
  if (!key || !SAFE_SCALE_RE.test(safeVal)) {
    return NextResponse.json({ success: false, error: 'Tipo o escala de animación inválida' }, { status: 400 });
  }
  const r = await safeExec(`${ctx.adbTarget} shell settings put global ${key} ${safeVal}`);
  return NextResponse.json({ success: r.ok, message: r.ok ? `${key}=${safeVal}x` : r.err });
}

export async function getAnimationScale(ctx: ActionContext) {
  const scales: Record<string, string> = {};
  for (const k of ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']) {
    const r = await safeExec(`${ctx.adbTarget} shell settings get global ${k}`);
    scales[k] = r.ok && r.out ? r.out.trim() || '1.0' : '1.0';
  }
  return NextResponse.json({ success: true, scales });
}

// ── DPI / Display ──────────────────────────────────────────────────

export async function setDpi(ctx: ActionContext, body: { dpi: number }) {
  const r = await safeExec(`${ctx.adbTarget} shell wm density ${body.dpi}`);
  return NextResponse.json({ success: r.ok, message: r.ok ? `DPI ajustado a ${body.dpi}` : r.err });
}

export async function getDpi(ctx: ActionContext) {
  const r = await safeExec(`${ctx.adbTarget} shell wm density`, 5000);
  const match = r.ok ? r.out.match(/\d+/) : null;
  return NextResponse.json({ success: true, dpi: match ? parseInt(match[0]) : 420 });
}

export async function setFontScale(ctx: ActionContext, body: { scale: number }) {
  const r = await safeExec(`${ctx.adbTarget} shell settings put system font_scale ${body.scale}`);
  return NextResponse.json({ success: r.ok, message: r.ok ? `Escala: ${body.scale}x` : r.err });
}

export async function setScreenTimeout(ctx: ActionContext, body: { timeout: number }) {
  const r = await safeExec(`${ctx.adbTarget} shell settings put system screen_off_timeout ${body.timeout}`);
  return NextResponse.json({ success: r.ok, message: r.ok ? `Timeout: ${body.timeout}ms` : r.err });
}

export async function setPeakRefresh(ctx: ActionContext, body: { hz: number }) {
  const r = await safeExec(`${ctx.adbTarget} shell settings put system peak_refresh_rate ${body.hz}`);
  return NextResponse.json({ success: r.ok, message: r.ok ? `Refresco: ${body.hz}Hz` : r.err });
}

export async function setNightMode(ctx: ActionContext, body: { mode: string }) {
  const r = await safeExec(`${ctx.adbTarget} shell settings put secure ui_night_mode ${body.mode}`);
  return NextResponse.json({ success: r.ok, message: r.ok ? `Modo noche: ${body.mode}` : r.err });
}

export async function setAutoBrightness(ctx: ActionContext, body: { enabled: boolean }) {
  const r = await safeExec(`${ctx.adbTarget} shell settings put system screen_brightness_mode ${body.enabled ? '1' : '0'}`);
  return NextResponse.json({ success: r.ok, message: r.ok ? `Auto-brillo: ${body.enabled ? 'ON' : 'OFF'}` : r.err });
}

export async function setStayAwake(ctx: ActionContext, body: { enabled: boolean }) {
  // 0=off, 3=USB, 7=USB+AC
  const r = await safeExec(`${ctx.adbTarget} shell settings put global stay_on_while_plugged_in ${body.enabled ? '7' : '0'}`);
  return NextResponse.json({ success: r.ok, message: r.ok ? `Stay awake: ${body.enabled ? 'ON' : 'OFF'}` : r.err });
}

export async function setDemoMode(ctx: ActionContext, body: { enabled: boolean }) {
  const r = await safeExec(`${ctx.adbTarget} shell settings put global sysui_demo_allowed ${body.enabled ? '1' : '0'}`);
  return NextResponse.json({ success: r.ok, message: r.ok ? 'Demo mode activado (batería 100%, sin notifs)' : r.err });
}

export async function setShowTouches(ctx: ActionContext, body: { enabled: boolean }) {
  const r = await safeExec(`${ctx.adbTarget} shell settings put system show_touches ${body.enabled ? '1' : '0'}`);
  return NextResponse.json({ success: r.ok, message: r.ok ? `Show touches: ${body.enabled ? 'ON' : 'OFF'}` : r.err });
}
