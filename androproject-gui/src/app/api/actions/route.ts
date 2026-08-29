import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getErrorMessage, safeExec } from './_lib/helpers';
import { buildContext, ActionContext } from './_lib/context';
import { validateAction } from './_lib/validation';
import { ADB } from '@/lib/config';

// Domain handlers
import * as device from './device';
import * as network from './network';
import * as display from './display';
import * as tweaks from './tweaks';
import * as stream from './stream';
import * as fastboot from './fastboot';
import * as diagnostics from './diagnostics';
import * as detect from './detect';
import * as apps from './apps';

type ActionHandler = (ctx: ActionContext, body: Record<string, unknown>) => Promise<NextResponse>;

// Action → handler mapping. Every action key routes to exactly one handler function.
const registry: Record<string, ActionHandler> = {
  // Device
  restart_adb:         (_ctx, _body) => device.restartAdb(),
  start_adb_server:    (_ctx, _body) => device.startAdbServer(),
  stop_adb_server:     (_ctx, _body) => device.stopAdbServer(),
  get_adb_status:      (_ctx, _body) => device.getAdbStatus(),
  disconnect_device:   (_ctx, body) => device.disconnectDevice(body as { serial?: string; all?: boolean }),
  reboot:               (ctx) => device.reboot(ctx),
  reboot_bootloader:    (ctx) => device.rebootBootloader(ctx),
  reboot_recovery:      (ctx) => device.rebootRecovery(ctx),
  power_off:            (ctx) => device.powerOff(ctx),
  get_foreground_app:   (ctx) => device.getForegroundApp(ctx),
  keyevent:             (ctx, body) => device.keyevent(ctx, body as { keycode: string }),
  adb_shell:            (ctx, body) => device.adbShell(ctx, body as { cmd: string }),
  input_text:           (ctx, body) => device.inputText(ctx, body as { text: string }),
  input_tap:            (ctx, body) => device.inputTap(ctx, body as { x: number; y: number }),
  input_swipe:          (ctx, body) => device.inputSwipe(ctx, body as { x1: number; y1: number; x2: number; y2: number; duration?: number }),

  // Device detection / listing
  detect:               (_ctx, body) => detect.detect(body),
  list_apps:            (ctx, _body) => apps.listApps(ctx),
  list_running:         (ctx, _body) => apps.listRunning(ctx),

  // Network
  enable_wifi:              (ctx) => network.enableWifi(ctx),
  radar:                    (_ctx) => network.radar(),
  scan_radar:               (_ctx) => network.radar(), // alias for page.tsx compatibility
  connect_adb:              async (_ctx, body) => connectAdb(body),
  set_wifi_scan_interval:   (ctx, body) => network.setWifiScanInterval(ctx, body as { interval: number }),
  set_wifi_power_save:      (ctx, body) => network.setWifiPowerSave(ctx, body as { enabled: boolean }),
  set_private_dns:          (ctx, body) => network.setPrivateDns(ctx, body as { mode: string; hostname?: string }),
  set_adguard_dns:          (ctx, body) => network.setAdguardDns(ctx, body as { profile: string }),
  dns_tunnel_setup:         (ctx, body) => network.dnsTunnelSetup(ctx, body as { domain: string; key: string }),
  dns_tunnel_start:         (ctx) => network.dnsTunnelStart(ctx),
  dns_tunnel_stop:          (ctx) => network.dnsTunnelStop(ctx),
  dns_tunnel_status:        (ctx) => network.dnsTunnelStatus(ctx),

  // Display
  set_animation_batch:  (ctx, body) => display.setAnimationBatch(ctx, body as { scales: Record<string, string> }),
  set_animation_scale:  (ctx, body) => display.setAnimationScale(ctx, body as { type: string; value: string }),
  get_animation_scale:  (ctx) => display.getAnimationScale(ctx),
  set_dpi:              (ctx, body) => display.setDpi(ctx, body as { dpi: number }),
  get_dpi:              (ctx) => display.getDpi(ctx),
  set_font_scale:       (ctx, body) => display.setFontScale(ctx, body as { scale: number }),
  set_screen_timeout:   (ctx, body) => display.setScreenTimeout(ctx, body as { timeout: number }),
  set_peak_refresh:     (ctx, body) => display.setPeakRefresh(ctx, body as { hz: number }),
  set_night_mode:       (ctx, body) => display.setNightMode(ctx, body as { mode: string }),
  set_auto_brightness:  (ctx, body) => display.setAutoBrightness(ctx, body as { enabled: boolean }),
  set_stay_awake:       (ctx, body) => display.setStayAwake(ctx, body as { enabled: boolean }),
  set_demo_mode:        (ctx, body) => display.setDemoMode(ctx, body as { enabled: boolean }),
  set_show_touches:     (ctx, body) => display.setShowTouches(ctx, body as { enabled: boolean }),

  // Tweaks
  set_gpu_tweak:              (ctx, body) => tweaks.setGpuTweak(ctx, body as { key: string; value?: string; reset?: boolean }),
  get_gpu_status:             (ctx) => tweaks.getGpuStatus(ctx),
  set_background_limit:       (ctx, body) => tweaks.setBackgroundLimit(ctx, body as { limit: string }),
  set_bluetooth_codec:        (ctx, body) => tweaks.setBluetoothCodec(ctx, body as { codec: string; sampleRate?: string; bitsPerSample?: string; ldacQuality?: string }),
  get_bluetooth_codec:        (ctx) => tweaks.getBluetoothCodec(ctx),
  set_bluetooth_absolute_volume: (ctx, body) => tweaks.setBluetoothAbsoluteVolume(ctx, body as { disable: string }),
  set_shade_style:            (ctx, body) => tweaks.setShadeStyle(ctx, body as Record<string, unknown>),

  // Stream — close_screen es alias de stop_screen, usar stop_screen directamente
  open_screen:    (ctx, body) => stream.openScreen(ctx, body as any),
  check_screen:   (ctx) => stream.checkOrStopScreen(ctx, 'check_screen'),
  stop_screen:    (ctx) => stream.checkOrStopScreen(ctx, 'stop_screen'),
  close_screen:   (ctx) => stream.checkOrStopScreen(ctx, 'stop_screen'), // alias retrocompatible

  screenshot:     (ctx) => stream.screenshot(ctx),
  start_record:   (ctx, body) => stream.startRecord(ctx, body as { videoSource?: string }),
  stop_record:    (ctx) => stream.stopRecord(ctx),

  // Fastboot
  fastboot_reboot:          (ctx) => fastboot.fastbootReboot(ctx),
  fastboot_reboot_recovery: (ctx) => fastboot.fastbootRebootRecovery(ctx),
  fastboot_erase:           (ctx) => fastboot.fastbootErase(ctx),

  // Diagnostics
  run_trim:               (ctx) => diagnostics.runTrim(ctx),
  get_diagnostics:        (ctx) => diagnostics.getDiagnostics(ctx),
  get_optimizer_settings: (ctx) => diagnostics.getOptimizerSettings(ctx),
  diagnose_screenshot:    (ctx) => diagnostics.diagnoseScreenshot(ctx),

  // Optimizer
  optimize_ram:           async (ctx, _body) => optimizeRam(ctx),
};

// ── Optimize RAM handler ─────────────────────────────────────────
async function optimizeRam(ctx: ActionContext) {
  const parseMemFree = async (): Promise<number> => {
    try {
      const { out } = await safeExec(`${ctx.adbTarget} shell cat /proc/meminfo`, 4000);
      const availMatch = out.match(/MemAvailable:\s+(\d+)\s+kB/i);
      if (availMatch) return Math.round(parseInt(availMatch[1], 10) / 1024);
      const freeMatch = out.match(/MemFree:\s+(\d+)\s+kB/i);
      if (freeMatch) return Math.round(parseInt(freeMatch[1], 10) / 1024);
    } catch {}
    return 0;
  };

  const ramBefore = await parseMemFree();

  // 1. Clear package caches across disk
  await safeExec(`${ctx.adbTarget} shell cmd package trim-caches 999999999`, 20000);
  // 2. Instruct system to trim memory on background apps
  await safeExec(`${ctx.adbTarget} shell am send-trim-memory --user 0 COMPLETE`, 5000);
  // 3. Stop cached background processes safely
  await safeExec(`${ctx.adbTarget} shell am kill-all`, 5000);

  const ramAfter = await parseMemFree();
  const freedMB = Math.max(0, ramAfter - ramBefore);

  return NextResponse.json({
    success: true,
    freedMB,
    message: freedMB > 0
      ? `RAM optimizada: se liberaron ${freedMB} MB de memoria cache y procesos de fondo.`
      : 'RAM optimizada: el sistema ya contaba con memoria óptima libre.',
  });
}

// ── Wireless ADB connection handler ───────────────────────────────
async function connectAdb(body: Record<string, unknown>) {
  const target = (body.target as string) || '';
  if (!target) return NextResponse.json({ success: false, error: 'IP:puerto requerido' }, { status: 400 });
  const { ok, out, err } = await safeExec(`"${ADB}" connect ${target}`, 10000);
  return NextResponse.json({ success: ok, message: ok ? `Conectado a ${target}` : err });
}

export async function POST(req: Request) {
  try {
    const raw = await req.json();

    // Validate and sanitize all inputs before any handler runs
    let body: Record<string, unknown>;
    try {
      body = validateAction(raw);
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const issues = err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
        return NextResponse.json({ success: false, error: `Validación fallida: ${issues}` }, { status: 400 });
      }
      throw err; // re-throw unexpected errors
    }

    const handler = registry[body.action as string];
    if (!handler) {
      return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });
    }

    const context = await buildContext(body);
    return handler(context, body);
  } catch (error: unknown) {
    console.error('[Actions API] Error:', getErrorMessage(error));
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
