// ── Shared types for all feature views ──────────────────────────────

export type DeviceData = {
  connected: boolean;
  connectionType?: string;
  model?: string;
  androidVersion?: string;
  serial: string;
  product?: string;
  transport_id?: string;
  resolution?: string;
  ram?: string;
  ramUsed?: string;
  ramUsagePercent?: number;
  storage?: string;
  storageUsedGB?: number;
  storageFreeGB?: number;
  storageUsagePercent?: number;
  cpuUsagePercent?: number;
  battery?: number;
  isCharging?: boolean;
  temperature?: string;
  state?: string;
  oemUnlockAllowed?: boolean;
  bootloaderLocked?: boolean;
  verifiedBootState?: string;
  vbmetaState?: string;
};

export type DeviceInfo = DeviceData;

export type SystemLogs = {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
};

export type NavSection = 'dashboard' | 'projection' | 'apps' | 'flasher' | 'curar' | 'archivos' | 'tools' | 'optimizer' | 'config';

export type QuickActionItem = {
  id: string;
  title: string;
  sub: string;
  icon: string;
};

export type AppInfo = {
  packageName: string;
  name: string;
  size: number;
  date: number;
  isSystem?: boolean;
  isBloatware?: boolean;
  isHidden?: boolean;
  hasOverlay?: boolean;
  isDisabled?: boolean;
  isGoogle?: boolean;
  isMalware?: boolean;
  threatName?: string;
  threatSeverity?: string;
  safeToRemove?: boolean;
  criticalSystem?: boolean;
};

export type AppPackage = AppInfo;

export type DiagnosticsStorage = {
  size?: string;
  used?: string;
  free?: string;
  usage?: string;
};

export type DiagnosticsData = {
  cpu?: Record<string, string>;
  ram?: Record<string, string>;
  storage?: DiagnosticsStorage;
  thermal?: string[];
  arch?: string;
  sdk?: string;
  kernel?: string;
  display_resolution?: string;
  display_dpi?: string;
  uptime?: string;
  [key: string]: string | Record<string, string> | string[] | undefined;
};

export interface AnimScales {
  window_animation_scale: string;
  transition_animation_scale: string;
  animator_duration_scale: string;
}

export interface GpuTweaks {
  force_gpu: boolean;
  disable_overlays: boolean;
  force_msaa: boolean;
}

export interface BluetoothInfo {
  bluetooth_a2dp_codec_selection?: string;
  bluetooth_a2dp_sample_rate_selection?: string;
  bluetooth_a2dp_bits_per_sample_selection?: string;
  bluetooth_a2dp_ldac_playback_quality?: string;
  bluetooth_disable_absolute_volume?: string;
}

export interface OptimizerSettings {
  animScales: AnimScales;
  dpi: number;
  gpuTweaks: GpuTweaks;
  backgroundLimit: string;
  screenTimeout: string;
  peakRefreshRate: string;
  nightMode: string;
  autoBrightness: boolean;
  stayAwake: boolean;
  demoMode: boolean;
  showTouches: boolean;
  wifiScanInterval: number;
  wifiPowerSave: boolean;
  privateDnsMode: string;
  privateDnsSpecifier: string;
  bluetooth: {
    codec: string;
    sampleRate: string;
    bitsPerSample: string;
    ldacQuality: string;
    disableAbsoluteVolume: boolean;
  };
  shade: {
    highContrast: boolean;
    fontScale: string;
  };
}

export interface DeviceListItem {
  serial: string;
  model: string;
  connectionType: string;
}
