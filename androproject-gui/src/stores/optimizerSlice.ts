// ── Optimizer Slice — performance, audio, network, display, shade ─
import type { StateCreator } from 'zustand';
import type { AnimScales, GpuTweaks, DiagnosticsData } from '@/features/types';

export type OptimizerTab = 'performance' | 'audio' | 'network' | 'diagnostics' | 'notifications';
export type AdguardProfile = 'off' | 'default' | 'family' | 'nonfiltering';

export interface OptimizerSlice {
  optimizerTab: OptimizerTab;
  // Performance
  animScales: AnimScales;
  currentDpi: number;
  gpuTweaks: GpuTweaks;
  backgroundLimit: string;
  screenTimeout: string;
  peakRefreshRate: string;
  nightMode: string;
  autoBrightness: boolean;
  stayAwake: boolean;
  demoMode: boolean;
  showTouches: boolean;
  // Audio
  bluetoothInfo: Record<string, string>;
  // Network
  wifiScanInterval: number;
  wifiPowerSave: boolean;
  privateDnsMode: string;
  privateDnsSpecifier: string;
  adguardProfile: AdguardProfile;
  dnsTunnelRunning: boolean;
  dnsTunnelDomain: string;
  dnsTunnelKey: string;
  dnsTunnelProxy: string;
  // Notifications (shade)
  shadeHighContrast: boolean;
  shadeReduceBlur: boolean;
  shadeBoldText: boolean;
  shadeSolidTheme: boolean;
  shadeFastAnims: boolean;
  shadeApplying: boolean;
  // Diagnostics
  diagnostics: DiagnosticsData | null;
  diagLoading: boolean;

  // Setters
  setOptimizerTab: (tab: OptimizerTab) => void;
  setAnimScales: (scales: AnimScales | ((prev: AnimScales) => AnimScales)) => void;
  setCurrentDpi: (dpi: number) => void;
  setGpuTweaks: (tweaks: GpuTweaks | ((prev: GpuTweaks) => GpuTweaks)) => void;
  setBackgroundLimit: (v: string) => void;
  setScreenTimeout: (v: string) => void;
  setPeakRefreshRate: (v: string) => void;
  setNightMode: (v: string) => void;
  setAutoBrightness: (v: boolean) => void;
  setStayAwake: (v: boolean) => void;
  setDemoMode: (v: boolean) => void;
  setShowTouches: (v: boolean) => void;
  setBluetoothInfo: (info: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setWifiScanInterval: (v: number) => void;
  setWifiPowerSave: (v: boolean) => void;
  setPrivateDnsMode: (v: string) => void;
  setPrivateDnsSpecifier: (v: string) => void;
  setAdguardProfile: (profile: AdguardProfile) => void;
  setDnsTunnelRunning: (v: boolean) => void;
  setDnsTunnelDomain: (v: string) => void;
  setDnsTunnelKey: (v: string) => void;
  setDnsTunnelProxy: (v: string) => void;
  setShadeHighContrast: (v: boolean) => void;
  setShadeReduceBlur: (v: boolean) => void;
  setShadeBoldText: (v: boolean) => void;
  setShadeSolidTheme: (v: boolean) => void;
  setShadeFastAnims: (v: boolean) => void;
  setShadeApplying: (v: boolean) => void;
  setDiagnostics: (d: DiagnosticsData | null) => void;
  setDiagLoading: (v: boolean) => void;
}

export const createOptimizerSlice: StateCreator<OptimizerSlice, [], [], OptimizerSlice> = (set) => ({
  optimizerTab: 'performance',
  animScales: { window_animation_scale: '1.0', transition_animation_scale: '1.0', animator_duration_scale: '1.0' },
  currentDpi: 420,
  gpuTweaks: { force_gpu: false, disable_overlays: false, force_msaa: false },
  backgroundLimit: 'standard',
  screenTimeout: '1800000',
  peakRefreshRate: '60',
  nightMode: '2',
  autoBrightness: false,
  stayAwake: false,
  demoMode: false,
  showTouches: false,
  bluetoothInfo: {},
  wifiScanInterval: 15000,
  wifiPowerSave: false,
  privateDnsMode: 'automatic',
  privateDnsSpecifier: '',
  adguardProfile: 'off',
  dnsTunnelRunning: false,
  dnsTunnelDomain: '',
  dnsTunnelKey: '',
  dnsTunnelProxy: '',
  shadeHighContrast: false,
  shadeReduceBlur: false,
  shadeBoldText: false,
  shadeSolidTheme: false,
  shadeFastAnims: false,
  shadeApplying: false,
  diagnostics: null,
  diagLoading: false,

  setOptimizerTab: (tab) => set({ optimizerTab: tab }),
  setAnimScales: (scales) => set((s) => ({ animScales: typeof scales === 'function' ? scales(s.animScales) : scales })),
  setCurrentDpi: (dpi) => set({ currentDpi: dpi }),
  setGpuTweaks: (tweaks) => set((s) => ({ gpuTweaks: typeof tweaks === 'function' ? tweaks(s.gpuTweaks) : tweaks })),
  setBackgroundLimit: (v) => set({ backgroundLimit: v }),
  setScreenTimeout: (v) => set({ screenTimeout: v }),
  setPeakRefreshRate: (v) => set({ peakRefreshRate: v }),
  setNightMode: (v) => set({ nightMode: v }),
  setAutoBrightness: (v) => set({ autoBrightness: v }),
  setStayAwake: (v) => set({ stayAwake: v }),
  setDemoMode: (v) => set({ demoMode: v }),
  setShowTouches: (v) => set({ showTouches: v }),
  setBluetoothInfo: (info) => set((s) => ({ bluetoothInfo: typeof info === 'function' ? info(s.bluetoothInfo) : info })),
  setWifiScanInterval: (v) => set({ wifiScanInterval: v }),
  setWifiPowerSave: (v) => set({ wifiPowerSave: v }),
  setPrivateDnsMode: (v) => set({ privateDnsMode: v }),
  setPrivateDnsSpecifier: (v) => set({ privateDnsSpecifier: v }),
  setAdguardProfile: (profile) => set({ adguardProfile: profile }),
  setDnsTunnelRunning: (v) => set({ dnsTunnelRunning: v }),
  setDnsTunnelDomain: (v) => set({ dnsTunnelDomain: v }),
  setDnsTunnelKey: (v) => set({ dnsTunnelKey: v }),
  setDnsTunnelProxy: (v) => set({ dnsTunnelProxy: v }),
  setShadeHighContrast: (v) => set({ shadeHighContrast: v }),
  setShadeReduceBlur: (v) => set({ shadeReduceBlur: v }),
  setShadeBoldText: (v) => set({ shadeBoldText: v }),
  setShadeSolidTheme: (v) => set({ shadeSolidTheme: v }),
  setShadeFastAnims: (v) => set({ shadeFastAnims: v }),
  setShadeApplying: (v) => set({ shadeApplying: v }),
  setDiagnostics: (d) => set({ diagnostics: d }),
  setDiagLoading: (v) => set({ diagLoading: v }),
});
