// ============================================================================
// ARCHIVO: useProjectionTypes.ts
// QUÉ HACE: Define las interfaces públicas `ScrcpyOptions`, `UseProjectionReturn`
//           y la configuración por defecto `DEFAULT_SCRCPY_OPTIONS`.
// CÓMO FUNCIONA: Centraliza los contratos tipados compartidos entre el hook
//           `useProjection` y los componentes UI del estudio de proyección.
// POR QUÉ: Separar las definiciones de tipos mantiene `useProjection.ts` bajo
//           el límite estricto de 200 líneas (SRP / Clean Architecture).
// ============================================================================

import type React from 'react';

export interface ScrcpyOptions {
  maxSize: string;
  maxFps: string;
  bitRate: string;
  turnScreenOff: boolean;
  stayAwake: boolean;
  alwaysOnTop: boolean;
  borderless: boolean;
  videoSource: 'display' | 'camera';
  cameraFacing?: 'back' | 'front' | 'external';
  cameraSize?: string;
  cameraTorch?: boolean;
  enableAudio?: boolean;
}

export interface RecordActionResult {
  success: boolean;
  recording: boolean;
  message?: string;
  recordPath?: string | null;
}

export interface UseProjectionReturn {
  scrcpyActive: boolean;
  toggleScrcpy: (customOpts?: Partial<ScrcpyOptions>) => Promise<void>;
  scrcpyOptions: ScrcpyOptions;
  setScrcpyOptions: React.Dispatch<React.SetStateAction<ScrcpyOptions>>;
  fullscreen: boolean;
  toggleFullscreen: () => Promise<void>;
  sendKey: (keycode: string) => Promise<void>;
  screenshot: () => Promise<string | null>;
  isRecording: boolean;
  recordingSeconds: number;
  lastRecordedPath: string | null;
  toggleRecord: () => Promise<RecordActionResult>;
  powerOff: () => Promise<void>;
  reboot: () => Promise<void>;
  volumeUp: () => Promise<void>;
  volumeDown: () => Promise<void>;
  goBack: () => Promise<void>;
  goHome: () => Promise<void>;
  openRecent: () => Promise<void>;
  openAllApps: () => Promise<void>;
  togglePowerScreen: () => Promise<void>;
  wakeScreen: () => Promise<void>;
  toggleMute: () => Promise<void>;
  mediaPlayPause: () => Promise<void>;
  openSettings: () => Promise<void>;
  collapsePanels: () => Promise<void>;
  expandNotifications: () => Promise<void>;
  expandQuickSettings: () => Promise<void>;
  setOrientation: (mode: 'auto' | 'portrait' | 'landscape') => Promise<void>;
  isBusy: boolean;
  connectAdb: (ip: string, port?: string) => Promise<{ success: boolean; message?: string }>;
  isConnecting: boolean;
  autoProject: boolean;
  setAutoProject: (v: boolean) => void;
}

export const DEFAULT_SCRCPY_OPTIONS: ScrcpyOptions = {
  maxSize: '1080',
  maxFps: '60',
  bitRate: '16M',
  turnScreenOff: false,
  stayAwake: true,
  alwaysOnTop: false,
  borderless: false,
  videoSource: 'display',
};
