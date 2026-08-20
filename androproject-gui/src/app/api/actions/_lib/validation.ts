import { z } from 'zod';

// ── Base schema — every action request must have at least an action field ──
export const baseActionSchema = z.object({
  action: z.string().min(1, 'Se requiere una acción'),
  serial: z.string().optional(),
  ip: z.string().optional(),
  videoSource: z.enum(['display', 'camera']).optional(),
});

// ── Device actions ────────────────────────────────────────────────────
export const keyeventSchema = z.object({ keycode: z.string().min(1) });
export const adbShellSchema = z.object({ cmd: z.string().min(1).max(512) });

// ── Touch input actions ───────────────────────────────────────────────
export const inputTapSchema = z.object({
  x: z.number().int().min(0).max(10000),
  y: z.number().int().min(0).max(10000),
});
export const inputSwipeSchema = z.object({
  x1: z.number().int().min(0).max(10000),
  y1: z.number().int().min(0).max(10000),
  x2: z.number().int().min(0).max(10000),
  y2: z.number().int().min(0).max(10000),
  duration: z.number().int().min(0).max(5000).optional(),
});

// ── Network actions ───────────────────────────────────────────────────
export const wifiScanIntervalSchema = z.object({
  interval: z.number().int().min(0).max(300000),
});
export const wifiPowerSaveSchema = z.object({ enabled: z.boolean() });
export const privateDnsSchema = z.object({
  mode: z.enum(['off', 'automatic', 'hostname']),
  hostname: z.string().optional(),
});
export const adguardDnsSchema = z.object({
  profile: z.enum(['off', 'default', 'family', 'nonfiltering']),
});
export const dnsTunnelSetupSchema = z.object({
  domain: z.string().min(3, 'Dominio requerido'),
  key: z.string().min(1, 'Clave requerida'),
});

// ── Display actions ───────────────────────────────────────────────────
export const animationBatchSchema = z.object({
  scales: z.record(z.string(), z.string()),
});
export const animationScaleSchema = z.object({
  type: z.enum(['window', 'transition', 'animator']),
  value: z.string(),
});
export const dpiSchema = z.object({ dpi: z.number().int().min(120).max(800) });
export const fontScaleSchema = z.object({ scale: z.number().min(0.5).max(2.0) });
export const screenTimeoutSchema = z.object({ timeout: z.number().int().min(5000) });
export const peakRefreshSchema = z.object({ hz: z.number().int().min(30).max(144) });
export const nightModeSchema = z.object({ mode: z.enum(['0', '1', '2']) });
export const autoBrightnessSchema = z.object({ enabled: z.boolean() });
export const stayAwakeSchema = z.object({ enabled: z.boolean() });
export const demoModeSchema = z.object({ enabled: z.boolean() });
export const showTouchesSchema = z.object({ enabled: z.boolean() });

// ── Tweaks actions ────────────────────────────────────────────────────
export const gpuTweakSchema = z.object({
  key: z.enum(['force_gpu', 'disable_overlays', 'force_msaa']),
  value: z.string().optional(),
  reset: z.boolean().optional(),
});
export const backgroundLimitSchema = z.object({
  limit: z.enum(['standard', '4', '3', '2', '1']),
});
export const bluetoothCodecSchema = z.object({
  codec: z.enum(['sbc', 'aac', 'aptx', 'aptx_hd', 'ldac', 'lhdc']),
  sampleRate: z.string().optional(),
  bitsPerSample: z.string().optional(),
  ldacQuality: z.string().optional(),
});
export const bluetoothAbsoluteVolumeSchema = z.object({
  disable: z.enum(['0', '1']),
});
export const shadeStyleSchema = z.object({
  highContrast: z.boolean().optional(),
  reduceBlur: z.boolean().optional(),
  boldText: z.boolean().optional(),
  solidTheme: z.boolean().optional(),
  animationsFast: z.boolean().optional(),
});

// ── Per-action validation map ────────────────────────────────────────
export const actionSchemas: Record<string, z.ZodType<unknown>> = {
  keyevent:                  keyeventSchema,
  adb_shell:                 adbShellSchema,
  input_tap:                 inputTapSchema,
  input_swipe:               inputSwipeSchema,
  set_wifi_scan_interval:    wifiScanIntervalSchema,
  set_wifi_power_save:       wifiPowerSaveSchema,
  set_private_dns:           privateDnsSchema,
  set_adguard_dns:           adguardDnsSchema,
  dns_tunnel_setup:          dnsTunnelSetupSchema,
  set_animation_batch:       animationBatchSchema,
  set_animation_scale:       animationScaleSchema,
  set_dpi:                   dpiSchema,
  set_font_scale:            fontScaleSchema,
  set_screen_timeout:        screenTimeoutSchema,
  set_peak_refresh:          peakRefreshSchema,
  set_night_mode:            nightModeSchema,
  set_auto_brightness:       autoBrightnessSchema,
  set_stay_awake:            stayAwakeSchema,
  set_demo_mode:             demoModeSchema,
  set_show_touches:          showTouchesSchema,
  set_gpu_tweak:             gpuTweakSchema,
  set_background_limit:      backgroundLimitSchema,
  set_bluetooth_codec:       bluetoothCodecSchema,
  set_bluetooth_absolute_volume: bluetoothAbsoluteVolumeSchema,
  set_shade_style:           shadeStyleSchema,
};

/**
 * Validate request body against the schema for the given action.
 * Returns the parsed (and typed) body, or throws a ZodError with user-friendly messages.
 */
export function validateAction(body: Record<string, unknown>): Record<string, unknown> {
  // Always validate the base shape first
  const parsed = baseActionSchema.parse(body);
  const actionName = parsed.action;

  // If there's a specific schema for this action, validate with it
  const schema = actionSchemas[actionName];
  if (schema) {
    // Merge: validate the extra fields while preserving base fields
    const extra = schema.parse(body) as Record<string, unknown>;
    return { ...parsed, ...extra };
  }

  return parsed as Record<string, unknown>;
}
