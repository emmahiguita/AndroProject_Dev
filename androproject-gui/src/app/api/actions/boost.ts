// ============================================================================
// ARCHIVO: boost.ts
// QUÉ HACE: Activa/desactiva el Modo Desarrollador, abre sus ajustes en el
//           teléfono, controla cada opción individual de desarrollador y aplica
//           perfiles reales de velocidad, refresco y gráficos GPU por ADB.
// CÓMO FUNCIONA: Ejecuta comandos `adb shell settings`, `setprop` y `am start`
//           en lote, devolviendo siempre el estado real leído desde Android.
// POR QUÉ: Permitir control completo del Modo Desarrollador y perfiles Turbo
//           sin opciones huérfanas ni simulaciones (< 200 líneas, SRP).
// ============================================================================

import { NextResponse } from 'next/server';
import { safeExec } from './_lib/helpers';
import { ActionContext } from './_lib/context';

export type PerfProfileId = 'balanced' | 'fluid' | 'gaming' | 'restore';

export interface PerfStatus {
  developerMode: boolean; usbDebugging: boolean; wifiDebugging: boolean;
  stayAwake: boolean; showTouches: boolean; pointerLocation: boolean;
  dontKeepActivities: boolean; debugLayout: boolean; cachedFreezer: string;
  windowScale: string; transitionScale: string; animatorScale: string;
  disableBlur: boolean; gpuRenderer: string; disableOverlays: boolean;
  forceMsaa: boolean; peakRefresh: string; bgLimit: string;
}

const cleanVal = (raw: string, fb: string) => { const v = (raw || '').trim(); return !v || v === 'null' ? fb : v; };

const READ_CMDS = [
  'settings get global development_settings_enabled', 'settings get global window_animation_scale',
  'settings get global transition_animation_scale', 'settings get global animator_duration_scale',
  'settings get global disable_blur', 'settings get global hardware.hwui.renderer',
  'settings get global hardware.hwui.disable_overlays', 'settings get system peak_refresh_rate',
  'settings get global activity_manager_constants', 'settings get global adb_enabled',
  'settings get global adb_wifi_enabled', 'settings get global stay_on_while_plugged_in',
  'settings get system show_touches', 'settings get system pointer_location',
  'settings get global always_finish_activities', 'getprop debug.layout',
  'settings get global cached_apps_freezer', 'settings get global hardware.hwui.msaa',
].join('; echo ---SEP---; ');

/** Lee en un solo lote ADB el estado real de Modo Desarrollador y sus opciones. */
async function readStatus(ctx: ActionContext): Promise<{ ok: boolean; status: PerfStatus; err?: string }> {
  const { ok, out, err } = await safeExec(`${ctx.adbTarget} shell "${READ_CMDS}"`, 8000);
  const p = out.split('---SEP---').map((s) => s.trim());
  const bgMatch = cleanVal(p[8] || '', 'Estándar').match(/max_cached_processes=(\d+)/);
  return {
    ok, err,
    status: {
      developerMode: cleanVal(p[0], '0') === '1', windowScale: cleanVal(p[1], '1.0'),
      transitionScale: cleanVal(p[2], '1.0'), animatorScale: cleanVal(p[3], '1.0'),
      disableBlur: cleanVal(p[4], '0') === '1', gpuRenderer: cleanVal(p[5], 'Predeterminado'),
      disableOverlays: ['1', 'true'].includes(cleanVal(p[6], '0')), peakRefresh: cleanVal(p[7], 'Auto'),
      bgLimit: bgMatch ? `${bgMatch[1]} máx` : 'Estándar', usbDebugging: cleanVal(p[9], '1') === '1',
      wifiDebugging: cleanVal(p[10], '0') === '1', stayAwake: ['3', '7'].includes(cleanVal(p[11], '0')),
      showTouches: cleanVal(p[12], '0') === '1', pointerLocation: cleanVal(p[13], '0') === '1',
      dontKeepActivities: cleanVal(p[14], '0') === '1', debugLayout: cleanVal(p[15], 'false') === 'true',
      cachedFreezer: cleanVal(p[16], 'default'), forceMsaa: ['4', 'true', '1'].includes(cleanVal(p[17], '0')),
    },
  };
}

const isInvalidAndroid = (ctx: ActionContext) =>
  !ctx.targetSerial || ctx.targetSerial.startsWith('airplay-') || ctx.targetSerial.startsWith('apple-');

/** Devuelve el estado actual de ajustes de desarrollador y gráficos. */
export async function getPerformanceStatus(ctx: ActionContext) {
  if (isInvalidAndroid(ctx)) return NextResponse.json({ success: false, error: 'Requiere un dispositivo Android por ADB.' }, { status: 400 });
  const res = await readStatus(ctx);
  if (!res.ok) return NextResponse.json({ success: false, error: res.err || 'Dispositivo no disponible.' }, { status: 503 });
  return NextResponse.json({ success: true, status: res.status });
}

/** Activa o desactiva el Modo Desarrollador y opcionalmente abre el menú en el teléfono. */
export async function setDeveloperMode(ctx: ActionContext, body: { enabled: boolean; openSettings?: boolean }) {
  if (isInvalidAndroid(ctx)) return NextResponse.json({ success: false, error: 'Requiere un dispositivo Android por ADB.' }, { status: 400 });
  const cmd = body.enabled ? 'settings put global development_settings_enabled 1 && settings put global adb_enabled 1' : 'settings put global development_settings_enabled 0';
  const r = await safeExec(`${ctx.adbTarget} shell "${cmd}"`, 6000);
  if (body.openSettings && body.enabled) await safeExec(`${ctx.adbTarget} shell am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS`, 5000);
  const read = await readStatus(ctx);
  return NextResponse.json({
    success: r.ok, status: read.ok ? read.status : null,
    message: r.ok ? `Modo Desarrollador ${body.enabled ? 'ACTIVADO' : 'DESACTIVADO'}.` : (r.err || 'Error'),
  });
}

/** Abre la pantalla de Opciones de Desarrollador o Información del Teléfono en el móvil. */
export async function openDeveloperSettings(ctx: ActionContext, body: { screen?: 'dev' | 'about' }) {
  if (isInvalidAndroid(ctx)) return NextResponse.json({ success: false, error: 'Requiere un dispositivo Android por ADB.' }, { status: 400 });
  const isAbout = body.screen === 'about';
  const intent = isAbout ? 'android.settings.DEVICE_INFO_SETTINGS' : 'android.settings.APPLICATION_DEVELOPMENT_SETTINGS';
  const prefix = isAbout ? '' : 'settings put global development_settings_enabled 1; ';
  const r = await safeExec(`${ctx.adbTarget} shell "${prefix}am start -a ${intent}"`, 6000);
  const read = await readStatus(ctx);
  return NextResponse.json({
    success: r.ok, status: read.ok ? read.status : null,
    message: r.ok ? (isAbout ? 'Abierto "Acerca del teléfono".' : 'Opciones de Desarrollador abiertas en el teléfono.') : (r.err || 'Error al abrir pantalla.'),
  });
}

/** Modifica una opción individual del Modo Desarrollador en tiempo real. */
export async function setDeveloperOption(ctx: ActionContext, body: { option: string; value: string | boolean }) {
  if (isInvalidAndroid(ctx)) return NextResponse.json({ success: false, error: 'Requiere un dispositivo Android por ADB.' }, { status: 400 });
  const b = Boolean(body.value);
  const s = String(body.value ?? '').trim();
  const map: Record<string, string> = {
    stay_awake: `settings put global stay_on_while_plugged_in ${b ? '7' : '0'}`,
    show_touches: `settings put system show_touches ${b ? '1' : '0'}`,
    pointer_location: `settings put system pointer_location ${b ? '1' : '0'}`,
    dont_keep_activities: `settings put global always_finish_activities ${b ? '1' : '0'}`,
    debug_layout: `setprop debug.layout ${b ? 'true' : 'false'} && service call activity 1599295570 >/dev/null 2>&1 || true`,
    disable_blur: `settings put global disable_blur ${b ? '1' : '0'}`,
    disable_overlays: `settings put global hardware.hwui.disable_overlays ${b ? '1' : '0'}`,
    force_msaa: b ? 'settings put global hardware.hwui.msaa 4' : 'settings delete global hardware.hwui.msaa',
    adb_wifi: `settings put global adb_wifi_enabled ${b ? '1' : '0'}`,
    gpu_renderer: ['skiagl', 'skiavk'].includes(s) ? `settings put global hardware.hwui.renderer ${s}` : 'settings delete global hardware.hwui.renderer',
    cached_freezer: ['enabled', 'disabled', 'default'].includes(s) ? `settings put global cached_apps_freezer ${s}` : '',
  };
  const cmd = map[body.option];
  if (!cmd) return NextResponse.json({ success: false, error: `Opción no reconocida: ${body.option}` }, { status: 400 });
  const r = await safeExec(`${ctx.adbTarget} shell "settings put global development_settings_enabled 1 && ${cmd}"`, 6000);
  const read = await readStatus(ctx);
  return NextResponse.json({
    success: r.ok, status: read.ok ? read.status : null,
    message: r.ok ? `Opción ${body.option} actualizada.` : (r.err || 'Error aplicando opción'),
  });
}

const PROFILE_STEPS: Record<PerfProfileId, [string, string][]> = {
  balanced: [
    ['Modo Desarrollador ON', 'settings put global development_settings_enabled 1'],
    ['Animaciones 0.5x', 'settings put global window_animation_scale 0.5 && settings put global transition_animation_scale 0.5 && settings put global animator_duration_scale 0.5'],
    ['Blur normal y GPU estándar', 'settings put global disable_blur 0 && settings delete global hardware.hwui.renderer && settings delete global hardware.hwui.disable_overlays && settings delete global activity_manager_constants'],
  ],
  fluid: [
    ['Modo Desarrollador ON', 'settings put global development_settings_enabled 1'],
    ['Animaciones 0.5x + Sin Blur', 'settings put global window_animation_scale 0.5 && settings put global transition_animation_scale 0.5 && settings put global animator_duration_scale 0.5 && settings put global disable_blur 1'],
    ['Refresco 120Hz + Freezer ON', 'settings put system peak_refresh_rate 120 && settings put global activity_manager_constants max_cached_processes=4 && settings put global cached_apps_freezer enabled'],
  ],
  gaming: [
    ['Modo Desarrollador ON + Animaciones 0x', 'settings put global development_settings_enabled 1 && settings put global window_animation_scale 0.0 && settings put global transition_animation_scale 0.0 && settings put global animator_duration_scale 0.0'],
    ['Skia Vulkan + GPU Directa + 120Hz', 'settings put global disable_blur 1 && settings put global hardware.hwui.renderer skiavk && settings put global hardware.hwui.disable_overlays 1 && settings put system peak_refresh_rate 120'],
    ['Caché máx 2 + Trim RAM', 'settings put global activity_manager_constants max_cached_processes=2 && settings put global cached_apps_freezer enabled && am send-trim-memory --user 0 COMPLETE && am kill-all'],
  ],
  restore: [
    ['Animaciones 1.0x + Trazos OFF', 'settings put global window_animation_scale 1.0 && settings put global transition_animation_scale 1.0 && settings put global animator_duration_scale 1.0 && settings delete global disable_blur && settings put system show_touches 0 && settings put system pointer_location 0 && setprop debug.layout false'],
    ['Restaurar GPU, Refresco y Caché', 'settings delete global hardware.hwui.renderer && settings delete global hardware.hwui.disable_overlays && settings delete global hardware.hwui.msaa && settings delete system peak_refresh_rate && settings delete global activity_manager_constants && settings delete global cached_apps_freezer && settings put global always_finish_activities 0'],
  ],
};

/** Aplica un perfil real de velocidad, Modo Desarrollador y gráficos GPU. */
export async function applyPerformanceProfile(ctx: ActionContext, body: { profile: PerfProfileId }) {
  if (isInvalidAndroid(ctx)) return NextResponse.json({ success: false, error: 'Requiere un dispositivo Android por ADB.' }, { status: 400 });
  const steps = PROFILE_STEPS[body.profile] || PROFILE_STEPS.restore;
  const applied: string[] = [];
  const failed: string[] = [];
  for (const [label, cmd] of steps) {
    const res = await safeExec(`${ctx.adbTarget} shell "${cmd}"`, 6000);
    if (res.ok) applied.push(label);
    else failed.push(`${label}: ${res.err || 'error'}`);
  }
  const read = await readStatus(ctx);
  return NextResponse.json({
    success: applied.length > 0, profile: body.profile, applied, failed,
    status: read.ok ? read.status : null, message: `Perfil "${body.profile}" aplicado (${applied.length}/${steps.length}).`,
  });
}
