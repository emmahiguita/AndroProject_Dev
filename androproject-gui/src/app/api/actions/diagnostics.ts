// ============================================================================
// ARCHIVO: diagnostics.ts
// QUÉ HACE: Endpoints de limpieza de caché (`runTrim`), diagnóstico hardware/SO
//           (`getDiagnostics`), lectura de ajustes (`getOptimizerSettings`) y
//           re-exportación de `diagnoseScreenshot`.
// CÓMO FUNCIONA: Ejecuta las 11 lecturas ADB de `getDiagnostics` en paralelo
//           mediante `Promise.all` (eliminando el cuello de botella secuencial)
//           y delega el parsing a `_lib/diagnostics-parsers.ts`.
// POR QUÉ: Reducir la latencia de diagnóstico ~5x, corregir el bug `findstr`
//           en `thermalservice` y mantener el archivo < 130 líneas (SRP).
// ============================================================================

import { NextResponse } from 'next/server';
import { safeExec, execAsync } from './_lib/helpers';
import { ActionContext } from './_lib/context';
import {
  parseBattery,
  parseCpuInfo,
  parseMemInfo,
  parseOptimizerParts,
  parseStorage,
  parseThermal,
  parseUptime,
} from './_lib/diagnostics-parsers';

export { diagnoseScreenshot } from './_lib/screenshot-diag';

export async function runTrim(ctx: ActionContext) {
  const r = await safeExec(`${ctx.adbTarget} shell cmd package trim-caches 999999999`, 30000);
  return NextResponse.json({ success: r.ok, message: r.ok ? 'Caché limpiada' : r.err });
}

const safeRead = (cmd: string) => execAsync(cmd).then((r) => r.stdout).catch(() => '');

export async function getDiagnostics(ctx: ActionContext) {
  const t = ctx.adbTarget;
  const [battery, cpuRaw, memRaw, dfRaw, thermalRaw, wmSize, wmDensity, uptimeRaw, arch, sdk, kernel] =
    await Promise.all([
      safeRead(`${t} shell dumpsys battery`),
      safeRead(`${t} shell cat /proc/cpuinfo`),
      safeRead(`${t} shell cat /proc/meminfo`),
      safeRead(`${t} shell df -h /data`),
      safeRead(`${t} shell dumpsys thermalservice`),
      safeRead(`${t} shell wm size`),
      safeRead(`${t} shell wm density`),
      safeRead(`${t} shell cat /proc/uptime`),
      safeRead(`${t} shell getprop ro.product.cpu.abi`),
      safeRead(`${t} shell getprop ro.build.version.sdk`),
      safeRead(`${t} shell uname -r`),
    ]);

  const diag: Record<string, any> = {};
  if (battery) parseBattery(battery, diag);
  if (cpuRaw) diag.cpu = parseCpuInfo(cpuRaw);
  if (memRaw) diag.ram = parseMemInfo(memRaw);
  if (dfRaw) { const st = parseStorage(dfRaw); if (st) diag.storage = st; }
  if (thermalRaw) diag.thermal = parseThermal(thermalRaw);
  if (wmSize) diag.display_resolution = wmSize.trim();
  if (wmDensity) diag.display_dpi = wmDensity.trim();
  if (uptimeRaw) diag.uptime = parseUptime(uptimeRaw);
  if (arch) diag.arch = arch.trim();
  if (sdk) diag.sdk = sdk.trim();
  if (kernel) diag.kernel = kernel.trim();

  return NextResponse.json({ success: true, diagnostics: diag });
}

export async function getOptimizerSettings(ctx: ActionContext) {
  const cmds = [
    'settings get global window_animation_scale',
    'settings get global transition_animation_scale',
    'settings get global animator_duration_scale',
    'wm density',
    'settings get global hardware.hwui.renderer',
    'settings get global hardware.hwui.disable_overlays',
    'settings get global hardware.hwui.msaa',
    'settings get global activity_manager_constants',
    'settings get system screen_off_timeout',
    'settings get system peak_refresh_rate',
    'settings get secure ui_night_mode',
    'settings get system screen_brightness_mode',
    'settings get global stay_on_while_plugged_in',
    'settings get global sysui_demo_allowed',
    'settings get system show_touches',
    'settings get global wifi_scan_throttle_enabled',
    'settings get global wifi_scan_interval_ms',
    'settings get global wifi_power_save',
    'settings get global private_dns_mode',
    'settings get global private_dns_specifier',
    'settings get global bluetooth_a2dp_codec_selection',
    'settings get global bluetooth_a2dp_sample_rate_selection',
    'settings get global bluetooth_a2dp_bits_per_sample_selection',
    'settings get global bluetooth_a2dp_ldac_playback_quality',
    'settings get global bluetooth_disable_absolute_volume',
    'settings get secure high_text_contrast_enabled',
    'settings get system font_scale',
  ].join('; echo __SEP__; ');

  const r = await safeExec(`${ctx.adbTarget} shell "${cmds}"`, 20000);
  if (!r.ok) return NextResponse.json({ success: false, error: r.err });

  const parts = r.out.split('__SEP__').map((s: string) => s.replace(/\r?\n/g, ' ').trim());
  return NextResponse.json({ success: true, settings: parseOptimizerParts(parts) });
}
