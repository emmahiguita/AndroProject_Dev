import { NextResponse } from 'next/server';
import { safeExec, execAsync } from './_lib/helpers';
import { ActionContext } from './_lib/context';

// ── Trim Cache ─────────────────────────────────────────────────────

export async function runTrim(ctx: ActionContext) {
  const r = await safeExec(`${ctx.adbTarget} shell cmd package trim-caches 999999999`, 30000);
  return NextResponse.json({ success: r.ok, message: r.ok ? 'Caché limpiada' : r.err });
}

// ── Full System Diagnostics ────────────────────────────────────────

export async function getDiagnostics(ctx: ActionContext) {
  const diag: Record<string, string | string[] | Record<string, string>> = {};

  // Battery
  try {
    const { stdout } = await execAsync(`${ctx.adbTarget} shell dumpsys battery`);
    for (const line of stdout.split('\n')) {
      const m = line.match(/^\s*(\w[\w\s]*?):\s*(.+)/);
      if (m) diag['battery_' + m[1].trim().replace(/\s+/g, '_').toLowerCase()] = m[2].trim();
    }
  } catch { /* battery info optional */ }

  // CPU
  try {
    const { stdout } = await execAsync(`${ctx.adbTarget} shell cat /proc/cpuinfo`);
    const cpu: Record<string, string> = {};
    cpu.raw = stdout.slice(0, 500);
    const hw = stdout.match(/Hardware\s*:\s*(.+)/);
    if (hw) cpu.hardware = hw[1].trim();
    const proc = stdout.match(/Processor\s*:\s*(.+)/);
    if (proc) cpu.processor = proc[1].trim();
    const cores = stdout.match(/processor\s*:\s*\d+/g);
    if (cores) cpu.cores = cores.length.toString();
    diag.cpu = cpu;
  } catch { /* cpu info optional */ }

  // RAM
  try {
    const { stdout } = await execAsync(`${ctx.adbTarget} shell cat /proc/meminfo`);
    const ram: Record<string, string> = {};
    for (const line of stdout.split('\n')) {
      const m = line.match(/^(\w+):\s+(\d+)\s*kB/);
      if (m) ram[m[1].toLowerCase()] = (parseInt(m[2]) / 1024).toFixed(0) + ' MB';
    }
    diag.ram = ram;
  } catch { /* ram info optional */ }

  // Storage
  try {
    const { stdout } = await execAsync(`${ctx.adbTarget} shell df -h /data`);
    const lines = stdout.split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].trim().split(/\s+/);
      diag.storage = { size: parts[1], used: parts[2], free: parts[3], usage: parts[4] };
    }
  } catch { /* storage info optional */ }

  // Thermal
  try {
    const { stdout } = await execAsync(`${ctx.adbTarget} shell dumpsys thermalservice | findstr "temperature"`);
    const temps: string[] = [];
    for (const line of stdout.split('\n')) {
      const m = line.match(/(\S+).*?(\d+\.?\d*)\s*°?C/);
      if (m) temps.push(`${m[1]}: ${m[2]}°C`);
    }
    diag.thermal = temps.slice(0, 10);
  } catch { /* thermal optional */ }

  // Display
  try {
    const { stdout: wm } = await execAsync(`${ctx.adbTarget} shell wm size`);
    diag.display_resolution = wm.trim();
    const { stdout: dpi } = await execAsync(`${ctx.adbTarget} shell wm density`);
    diag.display_dpi = dpi.trim();
  } catch { /* display optional */ }

  // Uptime
  try {
    const { stdout } = await execAsync(`${ctx.adbTarget} shell cat /proc/uptime`);
    const secs = parseFloat(stdout.split(' ')[0]);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    diag.uptime = `${h}h ${m}m`;
  } catch { /* uptime optional */ }

  // Arch / SDK / Kernel
  try {
    const { stdout: arch } = await execAsync(`${ctx.adbTarget} shell getprop ro.product.cpu.abi`);
    diag.arch = arch.trim();
    const { stdout: sdk } = await execAsync(`${ctx.adbTarget} shell getprop ro.build.version.sdk`);
    diag.sdk = sdk.trim();
    const { stdout: kernel } = await execAsync(`${ctx.adbTarget} shell uname -r`);
    diag.kernel = kernel.trim();
  } catch { /* system info optional */ }

  return NextResponse.json({ success: true, diagnostics: diag });
}

// ── Read All Optimizer Settings ────────────────────────────────────

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
  const [
    windowAnim, transitionAnim, animatorAnim,
    densityRaw, gpuRenderer, gpuOverlays, gpuMsaa,
    bgLimit, screenTimeoutRaw, peakRefreshRaw,
    nightModeRaw, autoBrightnessRaw, stayAwakeRaw, demoModeRaw, showTouchesRaw,
    wifiScanThrottleRaw, wifiScanIntervalRaw, wifiPowerSaveRaw,
    privateDnsModeRaw, privateDnsSpecifierRaw,
    btCodecRaw, btSampleRateRaw, btBitsPerSampleRaw, btLdacQualityRaw, btAbsoluteVolumeRaw,
    highContrastRaw, fontScaleRaw,
  ] = parts;

  // Parse DPI
  const densityStr = densityRaw || '';
  const dpiMatch = densityStr.match(/Override density:\s*(\d+)/) || densityStr.match(/Physical density:\s*(\d+)/);
  const dpi = dpiMatch ? parseInt(dpiMatch[1]) : 420;

  // Parse background limit
  let bgLimitVal = 'standard';
  if (bgLimit && bgLimit.trim() !== 'null') {
    const maxCached = bgLimit.match(/max_cached_processes[^0-9]*(\d+)/);
    if (maxCached) bgLimitVal = maxCached[1];
  }

  // Parse WiFi scan interval
  const wifiThrottle = (wifiScanThrottleRaw || '').trim();
  const wifiInterval = wifiThrottle === '0'
    ? 0
    : (parseInt((wifiScanIntervalRaw || '').trim()) || 15000);

  return NextResponse.json({
    success: true,
    settings: {
      animScales: {
        window_animation_scale: (windowAnim || '1.0').trim(),
        transition_animation_scale: (transitionAnim || '1.0').trim(),
        animator_duration_scale: (animatorAnim || '1.0').trim(),
      },
      dpi,
      gpuTweaks: {
        force_gpu: (gpuRenderer || '').trim() === 'skiavk',
        disable_overlays: (gpuOverlays || '').trim() === 'true',
        force_msaa: (gpuMsaa || '').trim() === '4',
      },
      backgroundLimit: bgLimitVal,
      screenTimeout: (screenTimeoutRaw || '1800000').trim(),
      peakRefreshRate: (peakRefreshRaw || '60').trim(),
      nightMode: (nightModeRaw || '2').trim(),
      autoBrightness: (autoBrightnessRaw || '').trim() === '1',
      stayAwake: ['3', '7'].includes((stayAwakeRaw || '').trim()),
      demoMode: (demoModeRaw || '').trim() === '1',
      showTouches: (showTouchesRaw || '').trim() === '1',
      wifiScanInterval: wifiInterval,
      wifiPowerSave: (wifiPowerSaveRaw || '').trim() === '1',
      privateDnsMode: (privateDnsModeRaw || 'automatic').trim(),
      privateDnsSpecifier: (privateDnsSpecifierRaw || '').trim(),
      bluetooth: {
        codec: (btCodecRaw || 'null').trim(),
        sampleRate: (btSampleRateRaw || 'null').trim(),
        bitsPerSample: (btBitsPerSampleRaw || 'null').trim(),
        ldacQuality: (btLdacQualityRaw || 'null').trim(),
        disableAbsoluteVolume: (btAbsoluteVolumeRaw || '').trim() === '1',
      },
      shade: {
        highContrast: (highContrastRaw || '').trim() === '1',
        fontScale: (fontScaleRaw || '1.0').trim(),
      },
    },
  });
}

// ── Screenshot Diagnostic & Repair ──────────────────────────────────

export async function diagnoseScreenshot(ctx: ActionContext) {
  const findings: string[] = [];
  const repaired: string[] = [];

  // 1. Check screencap binary
  const screencapPath = await safeExec(`${ctx.adbTarget} shell which screencap`);
  if (!screencapPath.out?.includes('/system/bin/screencap')) {
    findings.push('SCREENCAP_MISSING: binario screencap no encontrado');
  }

  // 2. Test actual capture
  const testPath = '/data/local/tmp/_ap_diag_test.png';
  await safeExec(`${ctx.adbTarget} shell screencap -p ${testPath}`);
  const sizeOut = await safeExec(`${ctx.adbTarget} shell stat -c %s ${testPath} 2>/dev/null || wc -c < ${testPath} 2>/dev/null`);
  const testSize = parseInt((sizeOut.out || '0').replace(/\D/g, '')) || 0;
  await safeExec(`${ctx.adbTarget} shell rm -f ${testPath}`);

  if (testSize < 5000 && testSize > 0) {
    findings.push('FLAG_SECURE_DETECTED: captura genera archivo diminuto (' + testSize + ' bytes) — app foreground bloquea');
  } else if (testSize === 0) {
    findings.push('SCREENCAP_FAILED: screencap no genera archivo — posible error del display HAL');
  }

  // 3. Check ColorOS settings
  const globalDisable = await safeExec(`${ctx.adbTarget} shell settings get global disable_screen_shot`);
  if ((globalDisable.out || '').trim() === '1') {
    findings.push('GLOBAL_DISABLE: disable_screen_shot=1 bloquea todas las capturas');
    // Auto-repair
    await safeExec(`${ctx.adbTarget} shell settings delete global disable_screen_shot`);
    await safeExec(`${ctx.adbTarget} shell settings put global disable_screen_shot 0`);
    repaired.push('GLOBAL_DISABLE: eliminado');
  }

  const threeFinger = await safeExec(`${ctx.adbTarget} shell settings get system oppo_three_finger_screenshot`);
  if ((threeFinger.out || '').trim() === '0') {
    findings.push('THREE_FINGER_OFF: gesto de tres dedos desactivado');
    await safeExec(`${ctx.adbTarget} shell settings put system oppo_three_finger_screenshot 1`);
    await safeExec(`${ctx.adbTarget} shell settings put system three_gesture_screenshot 1`);
    await safeExec(`${ctx.adbTarget} shell settings put system oppo_screenshot_gesture 1`);
    await safeExec(`${ctx.adbTarget} shell settings put secure screenshot_enabled 1`);
    repaired.push('THREE_FINGER: activado');
  }

  // 4. Check device policy
  const dpm = await safeExec(`${ctx.adbTarget} shell dumpsys device_policy | grep -i 'mScreenCaptureDisabled\\|screenshot'`);
  if ((dpm.out || '').toLowerCase().includes('true') || (dpm.out || '').toLowerCase().includes('disabled')) {
    findings.push('DEVICE_POLICY: política de administrador bloquea capturas');
  }

  // 5. Check work profile
  const users = await safeExec(`${ctx.adbTarget} shell pm list users`);
  if ((users.out || '').includes(':20}')) {
    findings.push('WORK_PROFILE: perfil de trabajo detectado — puede tener restricciones');
  }

  // 6. Repair: restart SystemUI if anything was fixed
  if (repaired.length > 0) {
    await safeExec(`${ctx.adbTarget} shell pkill -f com.android.systemui`);
    repaired.push('SystemUI: reiniciado');
  }

  // 7. Final test
  await safeExec(`${ctx.adbTarget} shell input keyevent 120`); // SYSRQ
  await new Promise(r => setTimeout(r, 1000));

  const finalCheck = await safeExec(`${ctx.adbTarget} shell ls -lt /sdcard/Pictures/Screenshots/ | head -3`);
  const finalOk = (finalCheck.out || '').includes('.png');

  return NextResponse.json({
    success: true,
    repaired: repaired.length > 0,
    findings,
    fixes: repaired,
    captureTestOk: finalOk,
    message: finalOk
      ? 'Captura funcionando correctamente'
      : findings.length > 0
        ? `Problemas encontrados: ${findings.join('; ')}`
        : 'Sin problemas detectados pero la captura de prueba falló. Probá manualmente Power+Vol Down.',
  });
}
