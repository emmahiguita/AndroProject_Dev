// ── Device Slice — device detection, connectivity, screen keys ─────
import type { StateCreator } from 'zustand';
import type { DeviceData, DeviceListItem } from '@/features/types';

export interface DeviceSlice {
  device: DeviceData | null;
  loading: boolean;
  deviceIP: string | null;
  activeSerial: string | null;
  devicesList: DeviceListItem[];
  foregroundApp: string;
  secureAppsList: string[];
  isSecureApp: boolean;
  isScreenStreaming: boolean;
  screenBusy: boolean;
  videoSource: 'display' | 'camera';
  isRecording: boolean;
  recordingElapsed: string;
  recordingPath: string | null;
  isScreenExpanded: boolean;

  setDevice: (d: DeviceData | null) => void;
  setLoading: (v: boolean) => void;
  setDeviceIP: (ip: string | null) => void;
  setActiveSerial: (s: string | null) => void;
  setDevicesList: (list: DeviceListItem[]) => void;
  setForegroundApp: (app: string) => void;
  setSecureAppsList: (list: string[]) => void;
  setScreenStreaming: (v: boolean) => void;
  setScreenBusy: (v: boolean) => void;
  setVideoSource: (src: 'display' | 'camera') => void;
  setRecording: (v: boolean) => void;
  setRecordingElapsed: (t: string) => void;
  setRecordingPath: (p: string | null) => void;
  setScreenExpanded: (v: boolean) => void;
}

export const createDeviceSlice: StateCreator<DeviceSlice, [], [], DeviceSlice> = (set) => ({
  device: null,
  loading: true,
  deviceIP: null,
  activeSerial: null,
  devicesList: [],
  foregroundApp: 'Buscando...',
  secureAppsList: [],
  isSecureApp: false,
  isScreenStreaming: false,
  screenBusy: false,
  videoSource: 'display',
  isRecording: false,
  recordingElapsed: '00:00',
  recordingPath: null,
  isScreenExpanded: true,

  setDevice: (d) => set({ device: d }),
  setLoading: (v) => set({ loading: v }),
  setDeviceIP: (ip) => set({ deviceIP: ip }),
  setActiveSerial: (s) => set({ activeSerial: s }),
  setDevicesList: (list) => set({ devicesList: list }),
  setForegroundApp: (app) => set({ foregroundApp: app }),
  setSecureAppsList: (list) => set({ secureAppsList: list, isSecureApp: list.length > 0 }),
  setScreenStreaming: (v) => set({ isScreenStreaming: v }),
  setScreenBusy: (v) => set({ screenBusy: v }),
  setVideoSource: (src) => set({ videoSource: src }),
  setRecording: (v) => set({ isRecording: v }),
  setRecordingElapsed: (t) => set({ recordingElapsed: t }),
  setRecordingPath: (p) => set({ recordingPath: p }),
  setScreenExpanded: (v) => set({ isScreenExpanded: v }),
});
