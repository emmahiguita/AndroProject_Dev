// ============================================================================
// ARCHIVO: diagnostics-parsers.ts
// QUÉ HACE: Parsea salidas crudas de ADB (`battery`, `cpuinfo`, `meminfo`,
//           `df`, `thermalservice`, `uptime`) y configuración del optimizador.
// CÓMO FUNCIONA: Funciones puras sin efectos secundarios; reemplaza el antiguo
//           `findstr` (comando Windows que fallaba dentro de `adb shell` Linux)
//           por filtrado seguro en JavaScript.
// POR QUÉ: Separar parsers puros mantiene `diagnostics.ts` < 200 líneas (SRP).
// ============================================================================

export function parseBattery(stdout: string, diag: Record<string, any>): void {
  for (const line of stdout.split('\n')) {
    const m = line.match(/^\s*(\w[\w\s]*?):\s*(.+)/);
    if (m) diag['battery_' + m[1].trim().replace(/\s+/g, '_').toLowerCase()] = m[2].trim();
  }
}

export function parseCpuInfo(stdout: string): Record<string, string> {
  const cpu: Record<string, string> = { raw: stdout.slice(0, 500) };
  const hw = stdout.match(/Hardware\s*:\s*(.+)/);
  if (hw) cpu.hardware = hw[1].trim();
  const proc = stdout.match(/Processor\s*:\s*(.+)/);
  if (proc) cpu.processor = proc[1].trim();
  const cores = stdout.match(/processor\s*:\s*\d+/g);
  if (cores) cpu.cores = cores.length.toString();
  return cpu;
}

export function parseMemInfo(stdout: string): Record<string, string> {
  const ram: Record<string, string> = {};
  for (const line of stdout.split('\n')) {
    const m = line.match(/^(\w+):\s+(\d+)\s*kB/);
    if (m) ram[m[1].toLowerCase()] = `${(parseInt(m[2], 10) / 1024).toFixed(0)} MB`;
  }
  return ram;
}

export function parseStorage(stdout: string) {
  const lines = stdout.split('\n');
  if (lines.length < 2) return undefined;
  const parts = lines[1].trim().split(/\s+/);
  return { size: parts[1], used: parts[2], free: parts[3], usage: parts[4] };
}

export function parseThermal(stdout: string): string[] {
  const temps: string[] = [];
  for (const line of stdout.split('\n')) {
    if (!/temperature/i.test(line)) continue;
    const m = line.match(/(\S+).*?(\d+\.?\d*)\s*°?C/);
    if (m) temps.push(`${m[1]}: ${m[2]}°C`);
  }
  return temps.slice(0, 10);
}

export function parseUptime(stdout: string): string {
  const secs = parseFloat(stdout.split(' ')[0]) || 0;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

export function parseOptimizerParts(parts: string[]) {
  const [
    windowAnim, transitionAnim, animatorAnim, densityRaw,
    gpuRenderer, gpuOverlays, gpuMsaa, bgLimit, screenTimeoutRaw, peakRefreshRaw,
    nightModeRaw, autoBrightnessRaw, stayAwakeRaw, demoModeRaw, showTouchesRaw,
    wifiScanThrottleRaw, wifiScanIntervalRaw, wifiPowerSaveRaw,
    privateDnsModeRaw, privateDnsSpecifierRaw,
    btCodecRaw, btSampleRateRaw, btBitsPerSampleRaw, btLdacQualityRaw, btAbsoluteVolumeRaw,
    highContrastRaw, fontScaleRaw,
  ] = parts;

  const dpiMatch = (densityRaw || '').match(/Override density:\s*(\d+)/) || (densityRaw || '').match(/Physical density:\s*(\d+)/);
  let bgLimitVal = 'standard';
  if (bgLimit && bgLimit.trim() !== 'null') {
    const maxCached = bgLimit.match(/max_cached_processes[^0-9]*(\d+)/);
    if (maxCached) bgLimitVal = maxCached[1];
  }
  const wifiThrottle = (wifiScanThrottleRaw || '').trim();

  return {
    animScales: {
      window_animation_scale: (windowAnim || '1.0').trim(),
      transition_animation_scale: (transitionAnim || '1.0').trim(),
      animator_duration_scale: (animatorAnim || '1.0').trim(),
    },
    dpi: dpiMatch ? parseInt(dpiMatch[1], 10) : 420,
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
    wifiScanInterval: wifiThrottle === '0' ? 0 : (parseInt((wifiScanIntervalRaw || '').trim(), 10) || 15000),
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
  };
}
