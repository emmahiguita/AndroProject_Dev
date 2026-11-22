// ============================================================================
// ARCHIVO: boost.ts
// QUÉ HACE: Activa opciones del Modo Desarrollador y perfiles reales de
//           rendimiento, animaciones, refresco y gráficos GPU por ADB.
// CÓMO FUNCIONA: Ejecuta comandos `adb shell settings` y `am` según el perfil
//           elegido (`balanced`, `fluid`, `gaming`, `restore`) y lee el estado
//           en vivo desde Android sin inventar métricas.
// POR QUÉ: Permitir potenciar la velocidad y gráficos de Android desde el
//           Optimizador con opción segura de restauración a fábrica (SRP).
// ============================================================================

import { NextResponse } from 'next/server';
import { safeExec } from './_lib/helpers';
import { ActionContext } from './_lib/context';

export type PerfProfileId = 'balanced' | 'fluid' | 'gaming' | 'restore';

export interface PerfStatus {
  developerMode: boolean;
  windowScale: string;
  transitionScale: string;
  animatorScale: string;
  disableBlur: boolean;
  gpuRenderer: string;
  disableOverlays: boolean;
  peakRefresh: string;
  bgLimit: string;
}

const cleanVal = (raw: string, fallback: string) => {
  const v = raw.trim();
  return !v || v === 'null' ? fallback : v;
};

/** Lee en un solo lote ADB el estado real de Modo Desarrollador y gráficos. */
async function readStatus(ctx: ActionContext): Promise<{ ok: boolean; status: PerfStatus; err?: string }> {
  const cmds = [
    'settings get global development_settings_enabled',
    'settings get global window_animation_scale',
    'settings get global transition_animation_scale',
    'settings get global animator_duration_scale',
    'settings get global disable_blur',
    'settings get global hardware.hwui.renderer',
    'settings get global hardware.hwui.disable_overlays',
    'settings get system peak_refresh_rate',
    'settings get global activity_manager_constants',
  ].join('; echo ---SEP---; ');

  const { ok, out, err } = await safeExec(`${ctx.adbTarget} shell "${cmds}"`, 8000);
  const parts = out.split('---SEP---').map((s) => s.trim());

  const bgRaw = cleanVal(parts[8] || '', 'Estándar');
  const bgMatch = bgRaw.match(/max_cached_processes=(\d+)/);

  return {
    ok,
    err,
    status: {
      developerMode: cleanVal(parts[0] || '', '0') === '1',
      windowScale: cleanVal(parts[1] || '', '1.0'),
      transitionScale: cleanVal(parts[2] || '', '1.0'),
      animatorScale: cleanVal(parts[3] || '', '1.0'),
      disableBlur: cleanVal(parts[4] || '', '0') === '1',
      gpuRenderer: cleanVal(parts[5] || '', 'Predeterminado'),
      disableOverlays: cleanVal(parts[6] || '', '0') === '1',
      peakRefresh: cleanVal(parts[7] || '', 'Auto'),
      bgLimit: bgMatch ? `${bgMatch[1]} máx` : 'Estándar',
    },
  };
}

/** Devuelve el estado actual de ajustes de desarrollador y gráficos. */
export async function getPerformanceStatus(ctx: ActionContext) {
  if (!ctx.targetSerial || ctx.targetSerial.startsWith('airplay-')) {
    return NextResponse.json({
      success: false,
      error: 'Requiere un dispositivo Android conectado por ADB.',
    }, { status: 400 });
  }
  const res = await readStatus(ctx);
  if (!res.ok) {
    return NextResponse.json({ success: false, error: res.err || 'Dispositivo no disponible por ADB.' }, { status: 503 });
  }
  return NextResponse.json({ success: true, status: res.status });
}

/** Aplica un perfil real de velocidad, Modo Desarrollador y gráficos GPU. */
export async function applyPerformanceProfile(
  ctx: ActionContext,
  body: { profile: PerfProfileId },
) {
  if (!ctx.targetSerial || ctx.targetSerial.startsWith('airplay-')) {
    return NextResponse.json({
      success: false,
      error: 'Requiere un dispositivo Android conectado por ADB.',
    }, { status: 400 });
  }

  const profile = body.profile;
  const steps: { label: string; cmd: string }[] = [];

  if (profile === 'balanced') {
    steps.push(
      { label: 'Modo Desarrollador ON', cmd: 'settings put global development_settings_enabled 1' },
      { label: 'Animaciones 0.5x', cmd: 'settings put global window_animation_scale 0.5 && settings put global transition_animation_scale 0.5 && settings put global animator_duration_scale 0.5' },
      { label: 'Blur normal', cmd: 'settings put global disable_blur 0' },
      { label: 'GPU estándar', cmd: 'settings delete global hardware.hwui.renderer && settings delete global hardware.hwui.disable_overlays' },
      { label: 'Procesos fondo estándar', cmd: 'settings delete global activity_manager_constants' },
    );
  } else if (profile === 'fluid') {
    steps.push(
      { label: 'Modo Desarrollador ON', cmd: 'settings put global development_settings_enabled 1' },
      { label: 'Animaciones 0.5x', cmd: 'settings put global window_animation_scale 0.5 && settings put global transition_animation_scale 0.5 && settings put global animator_duration_scale 0.5' },
      { label: 'Desactivar blur GPU', cmd: 'settings put global disable_blur 1' },
      { label: 'Refresco pico 120Hz', cmd: 'settings put system peak_refresh_rate 120' },
      { label: 'Límite procesos caché (4)', cmd: 'settings put global activity_manager_constants max_cached_processes=4' },
      { label: 'Congelador apps caché ON', cmd: 'settings put global cached_apps_freezer enabled' },
    );
  } else if (profile === 'gaming') {
    steps.push(
      { label: 'Modo Desarrollador ON', cmd: 'settings put global development_settings_enabled 1' },
      { label: 'Animaciones 0.0x (Instantáneo)', cmd: 'settings put global window_animation_scale 0.0 && settings put global transition_animation_scale 0.0 && settings put global animator_duration_scale 0.0' },
      { label: 'Desactivar blur GPU', cmd: 'settings put global disable_blur 1' },
      { label: 'Renderizador Skia Vulkan', cmd: 'settings put global hardware.hwui.renderer skiavk' },
      { label: 'Composición GPU directa', cmd: 'settings put global hardware.hwui.disable_overlays 1' },
      { label: 'Refresco pico 120Hz', cmd: 'settings put system peak_refresh_rate 120' },
      { label: 'Límite procesos caché (2)', cmd: 'settings put global activity_manager_constants max_cached_processes=2' },
      { label: 'Congelador apps caché ON', cmd: 'settings put global cached_apps_freezer enabled' },
      { label: 'Liberación RAM y fondo', cmd: 'am send-trim-memory --user 0 COMPLETE && am kill-all' },
    );
  } else {
    steps.push(
      { label: 'Animaciones 1.0x', cmd: 'settings put global window_animation_scale 1.0 && settings put global transition_animation_scale 1.0 && settings put global animator_duration_scale 1.0' },
      { label: 'Restaurar blur', cmd: 'settings delete global disable_blur' },
      { label: 'Restaurar render GPU', cmd: 'settings delete global hardware.hwui.renderer && settings delete global hardware.hwui.disable_overlays && settings delete global hardware.hwui.msaa' },
      { label: 'Restaurar refresco', cmd: 'settings delete system peak_refresh_rate && settings delete system min_refresh_rate' },
      { label: 'Restaurar procesos fondo', cmd: 'settings delete global activity_manager_constants && settings delete global cached_apps_freezer' },
    );
  }

  const applied: string[] = [];
  const failed: string[] = [];

  for (const step of steps) {
    const res = await safeExec(`${ctx.adbTarget} shell "${step.cmd}"`, 6000);
    if (res.ok) applied.push(step.label);
    else failed.push(`${step.label}: ${res.err || 'error'}`);
  }

  const read = await readStatus(ctx);
  return NextResponse.json({
    success: applied.length > 0,
    profile,
    applied,
    failed,
    status: read.ok ? read.status : null,
    message: failed.length === 0
      ? `Perfil "${profile}" aplicado (${applied.length} ajustes).`
      : `Perfil "${profile}" aplicado parcialmente (${applied.length}/${steps.length}).`,
  });
}
