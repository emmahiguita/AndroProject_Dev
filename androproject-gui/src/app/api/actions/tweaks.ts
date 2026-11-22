// ============================================================================
// ARCHIVO: tweaks.ts
// QUÉ HACE: Endpoints ADB para motor gráfico GPU (`setGpuTweak`, `getGpuStatus`),
//           límite de procesos en segundo plano (`setBackgroundLimit`), códecs
//           Bluetooth A2DP (`setBluetoothCodec`) y estilo del panel de sistema.
// CÓMO FUNCIONA: Valida claves y valores contra listas blancas estrictas y
//           ejecuta `adb shell settings put/delete global` sobre el dispositivo.
// POR QUÉ: Aislar ajustes avanzados de desarrollador (< 200 líneas, SRP).
// ============================================================================

import { NextResponse } from 'next/server';
import { safeExec } from './_lib/helpers';
import { ActionContext } from './_lib/context';

// ── GPU Tweaks ─────────────────────────────────────────────────────

const ALLOWED_GPU_VALUES = new Set(['skiagl', 'skiavk', 'opengl', '0', '1', 'true', 'false']);
const SAFE_INT_RE = /^\d{1,6}$/;

export async function setGpuTweak(ctx: ActionContext, body: { key: string; value?: string; reset?: boolean }) {
  const gpuKeys: Record<string, string> = {
    force_gpu: 'hardware.hwui.renderer',
    disable_overlays: 'hardware.hwui.disable_overlays',
    force_msaa: 'hardware.hwui.msaa',
  };
  const settingKey = gpuKeys[body.key];
  if (!settingKey) return NextResponse.json({ success: false, error: 'Clave GPU inválida' }, { status: 400 });

  let r;
  if (body.reset) {
    r = await safeExec(`${ctx.adbTarget} shell settings delete global ${settingKey}`);
  } else {
    const safeVal = String(body.value ?? '').trim();
    if (!ALLOWED_GPU_VALUES.has(safeVal)) {
      return NextResponse.json({ success: false, error: 'Valor GPU no permitido' }, { status: 400 });
    }
    r = await safeExec(`${ctx.adbTarget} shell settings put global ${settingKey} ${safeVal}`);
  }
  return NextResponse.json({ success: r.ok, message: r.ok ? `${body.key}=${body.reset ? 'reset' : body.value}` : r.err });
}

export async function getGpuStatus(ctx: ActionContext) {
  const info: Record<string, string> = {};
  const r1 = await safeExec(`${ctx.adbTarget} shell dumpsys SurfaceFlinger`);
  const glesLine = r1.ok ? r1.out.split('\n').find((l) => l.includes('GLES')) : '';
  info.gles = glesLine ? glesLine.trim() : r1.ok ? 'desconocido' : 'error';
  return NextResponse.json({ success: true, info });
}

// ── Background Process Limit ───────────────────────────────────────

export async function setBackgroundLimit(ctx: ActionContext, body: { limit: string }) {
  const { limit } = body;
  let r;
  if (limit === 'standard') {
    r = await safeExec(`${ctx.adbTarget} shell settings delete global activity_manager_constants`);
  } else {
    r = await safeExec(`${ctx.adbTarget} shell settings put global activity_manager_constants max_cached_processes=${limit}`);
  }
  return NextResponse.json({ success: r.ok, message: r.ok ? `Límite: ${limit}` : r.err });
}

// ── Bluetooth Codec ────────────────────────────────────────────────

export async function setBluetoothCodec(
  ctx: ActionContext,
  body: { codec: string; sampleRate?: string; bitsPerSample?: string; ldacQuality?: string }
) {
  const { codec, sampleRate, bitsPerSample, ldacQuality } = body;
  const codecMap: Record<string, string> = { sbc: '0', aac: '1', aptx: '2', aptx_hd: '3', ldac: '4', lhdc: '5' };
  const codecVal = codecMap[codec];
  const errors: string[] = [];

  if (codecVal) {
    const r = await safeExec(`${ctx.adbTarget} shell settings put global bluetooth_a2dp_codec_selection ${codecVal}`);
    if (!r.ok) errors.push(`codec:${r.err}`);
  }
  if (sampleRate) {
    if (!SAFE_INT_RE.test(sampleRate)) return NextResponse.json({ success: false, error: 'sampleRate inválido' }, { status: 400 });
    const r = await safeExec(`${ctx.adbTarget} shell settings put global bluetooth_a2dp_sample_rate_selection ${sampleRate}`);
    if (!r.ok) errors.push(`rate:${r.err}`);
  }
  if (bitsPerSample) {
    if (!SAFE_INT_RE.test(bitsPerSample)) return NextResponse.json({ success: false, error: 'bitsPerSample inválido' }, { status: 400 });
    const r = await safeExec(`${ctx.adbTarget} shell settings put global bluetooth_a2dp_bits_per_sample_selection ${bitsPerSample}`);
    if (!r.ok) errors.push(`bits:${r.err}`);
  }
  if (codec === 'ldac' && ldacQuality) {
    if (!SAFE_INT_RE.test(ldacQuality)) return NextResponse.json({ success: false, error: 'ldacQuality inválido' }, { status: 400 });
    const r = await safeExec(`${ctx.adbTarget} shell settings put global bluetooth_a2dp_ldac_playback_quality ${ldacQuality}`);
    if (!r.ok) errors.push(`ldac:${r.err}`);
  }

  return NextResponse.json({
    success: errors.length === 0,
    message: errors.length ? errors.join('; ') : `Codec: ${(codec || '').toUpperCase()}`,
  });
}

export async function getBluetoothCodec(ctx: ActionContext) {
  const info: Record<string, string> = {};
  const keys = [
    'bluetooth_a2dp_codec_selection',
    'bluetooth_a2dp_sample_rate_selection',
    'bluetooth_a2dp_bits_per_sample_selection',
    'bluetooth_a2dp_ldac_playback_quality',
    'bluetooth_disable_absolute_volume',
  ];
  for (const k of keys) {
    const r = await safeExec(`${ctx.adbTarget} shell settings get global ${k}`);
    info[k] = r.ok ? (r.out.trim() || 'default') : 'error';
  }
  return NextResponse.json({ success: true, info });
}

export async function setBluetoothAbsoluteVolume(ctx: ActionContext, body: { disable: string }) {
  const r = await safeExec(`${ctx.adbTarget} shell settings put global bluetooth_disable_absolute_volume ${body.disable}`);
  return NextResponse.json({ success: r.ok, message: r.ok ? `Vol.absoluto: ${body.disable === '1' ? 'OFF' : 'ON'}` : r.err });
}

// ── Notification Shade Style ───────────────────────────────────────

export async function setShadeStyle(
  ctx: ActionContext,
  body: {
    highContrast?: boolean;
    reduceBlur?: boolean;
    boldText?: boolean;
    solidTheme?: boolean;
    animationsFast?: boolean;
  }
) {
  const errors: string[] = [];

  if (body.highContrast !== undefined) {
    const r = await safeExec(`${ctx.adbTarget} shell settings put secure high_text_contrast_enabled ${body.highContrast ? '1' : '0'}`);
    if (!r.ok) errors.push(`contraste:${r.err}`);
  }

  if (body.reduceBlur !== undefined) {
    const rBlur = await safeExec(`${ctx.adbTarget} shell settings put global disable_blur ${body.reduceBlur ? '1' : '0'}`);
    const rOppo = await safeExec(`${ctx.adbTarget} shell settings put system oplus_disable_blur_effect ${body.reduceBlur ? '1' : '0'}`);
    if (!rBlur.ok && !rOppo.ok) errors.push(`desenfoque:${rBlur.err || rOppo.err}`);
  }

  if (body.animationsFast !== undefined) {
    const scale = body.animationsFast ? '0.5' : '1.0';
    for (const k of ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']) {
      const r = await safeExec(`${ctx.adbTarget} shell settings put global ${k} ${scale}`);
      if (!r.ok) errors.push(`${k}:${r.err}`);
    }
  }

  if (body.boldText === true) {
    const r = await safeExec(`${ctx.adbTarget} shell settings put system font_scale 1.1`);
    if (!r.ok) errors.push(`font:${r.err}`);
  } else if (body.boldText === false) {
    const r = await safeExec(`${ctx.adbTarget} shell settings put system font_scale 1.0`);
    if (!r.ok) errors.push(`font:${r.err}`);
  }

  if (body.solidTheme) {
    const r = await safeExec(`${ctx.adbTarget} shell settings put secure ui_night_mode 2`);
    if (!r.ok) errors.push(`night:${r.err}`);
  }

  return NextResponse.json({
    success: errors.length === 0,
    message: errors.length ? errors.join('; ') : 'Estilo iOS aplicado — panel de notificaciones optimizado',
  });
}
