// ── useProjection — Projection & Studio business logic ──────────
// SRP: manages scrcpy lifecycle, recording, orientation, quick controls.
// ADB Connect + Auto-projection for Samsung devices on same network.

'use client';

import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useActions } from './useActions';
import type { DeviceInfo } from '@/features/types';

export interface ScrcpyOptions {
  maxSize: string;
  maxFps: string;
  bitRate: string;
  turnScreenOff: boolean;
  stayAwake: boolean;
  alwaysOnTop: boolean;
  borderless: boolean;
  videoSource: 'display' | 'camera';
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
  toggleRecord: () => Promise<void>;
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
  // ADB Connect
  connectAdb: (ip: string, port?: string) => Promise<{ success: boolean; message?: string }>;
  isConnecting: boolean;
  // Auto-projection
  autoProject: boolean;
  setAutoProject: (v: boolean) => void;
}

const DEFAULT_OPTIONS: ScrcpyOptions = {
  maxSize: '1080',
  maxFps: '60',
  bitRate: '16M',
  turnScreenOff: false,
  stayAwake: true,
  alwaysOnTop: true,
  borderless: false,
  videoSource: 'display',
};

/** Polling interval for scrcpy status check (ms) — 2500ms for zero network lag */
const STATUS_POLL_MS = 2500;

export function useProjection(device: DeviceInfo | null | undefined): UseProjectionReturn {
  const { run } = useActions();
  const [scrcpyActive, setScrcpyActive] = useState(false);
  const [scrcpyOptions, setScrcpyOptions] = useState<ScrcpyOptions>(DEFAULT_OPTIONS);
  const [fullscreen, setFullscreen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [autoProject, setAutoProject] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Guard against double auto-start
  const autoStartingRef = useRef(false);
  const prevDeviceSerialRef = useRef<string | undefined>(undefined);

  const serial = device?.serial ?? undefined;

  // ── Scrcpy status polling (8s interval) ──
  useEffect(() => {
    if (!serial) return;
    let isMounted = true;

    const checkAlive = () => {
      run('check_screen', '', { serial }, false).then((res: any) => {
        if (isMounted) setScrcpyActive(res?.alive || false);
      }).catch(() => {});
    };

    checkAlive();
    const interval = setInterval(checkAlive, STATUS_POLL_MS);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [serial, run]);

  // ── Auto-projection: start scrcpy when device appears ──
  useEffect(() => {
    if (!autoProject || !serial || scrcpyActive || autoStartingRef.current || isBusy) return;

    // Only auto-start if the device just appeared (serial changed)
    if (prevDeviceSerialRef.current === serial) return;
    prevDeviceSerialRef.current = serial;

    autoStartingRef.current = true;
    run('open_screen', 'Auto-proyección detectada...', {
      serial,
      maxSize: scrcpyOptions.maxSize,
      maxFps: scrcpyOptions.maxFps,
      bitRate: scrcpyOptions.bitRate,
      turnScreenOff: scrcpyOptions.turnScreenOff,
      stayAwake: scrcpyOptions.stayAwake,
      alwaysOnTop: scrcpyOptions.alwaysOnTop,
      videoSource: scrcpyOptions.videoSource,
    }).then(() => {
      setScrcpyActive(true);
    }).catch(() => {}).finally(() => {
      autoStartingRef.current = false;
    });
  }, [autoProject, serial, scrcpyActive, isBusy, scrcpyOptions, run]);

  // NOTE: prevDeviceSerialRef is intentionally updated ONLY inside the auto-project
  // effect above, not in a separate useEffect. A second effect would race and
  // overwrite the ref before the auto-project logic could detect the serial change.

  // Clean up record timer on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

  // ── ADB Wi-Fi Connect ──
  const connectAdb = useCallback(async (ip: string, port?: string): Promise<{ success: boolean; message?: string }> => {
    const target = `${ip.trim()}:${(port || '5555').trim()}`;
    setIsConnecting(true);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect_adb', target }),
      });
      const data = await res.json();
      return { success: Boolean(data.success), message: data.message || data.error };
    } catch {
      return { success: false, message: 'Error de conexión de red' };
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // ── Scrcpy lifecycle ──
  const toggleScrcpy = useCallback(async (customOpts?: Partial<ScrcpyOptions>) => {
    if (!serial) return;
    setIsBusy(true);
    const opts = { ...scrcpyOptions, ...customOpts };
    try {
      if (scrcpyActive) {
        await run('stop_screen', 'Deteniendo scrcpy', { serial });
        setScrcpyActive(false);
      } else {
        await run('open_screen', 'Iniciando AndroProject nativo 60 FPS...', {
          serial,
          maxSize: opts.maxSize,
          maxFps: opts.maxFps,
          bitRate: opts.bitRate,
          turnScreenOff: opts.turnScreenOff,
          stayAwake: opts.stayAwake,
          alwaysOnTop: opts.alwaysOnTop,
          borderless: opts.borderless,
          videoSource: opts.videoSource,
        });
        setScrcpyActive(true);
      }
    } finally {
      setIsBusy(false);
    }
  }, [scrcpyActive, scrcpyOptions, serial, run]);

  // ── Screen Recording ──
  const toggleRecord = useCallback(async () => {
    if (!serial) return;
    setIsBusy(true);
    try {
      if (isRecording) {
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        await run('stop_record', 'Deteniendo grabación...', { serial });
        setIsRecording(false);
        setRecordingSeconds(0);
      } else {
        await run('start_record', 'Iniciando grabación HD silenciosa...', {
          serial,
          videoSource: scrcpyOptions.videoSource,
        });
        setIsRecording(true);
        setRecordingSeconds(0);
        recordTimerRef.current = setInterval(() => {
          setRecordingSeconds((s) => s + 1);
        }, 1000);
      }
    } finally {
      setIsBusy(false);
    }
  }, [isRecording, scrcpyOptions.videoSource, serial, run]);

  // ── Fullscreen ──
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  }, []);

  // ── Key commands ──
  const sendKey = useCallback(async (keycode: string) => {
    if (!serial) return;
    await run('keyevent', '', { keycode, serial }, false);
  }, [serial, run]);

  const goBack = useCallback(() => sendKey('KEYCODE_BACK'), [sendKey]);
  const goHome = useCallback(() => sendKey('KEYCODE_HOME'), [sendKey]);
  const openRecent = useCallback(() => sendKey('KEYCODE_APP_SWITCH'), [sendKey]);
  const openAllApps = useCallback(async () => {
    if (!serial) return;
    // Envía KEYCODE_ALL_APPS (keycode 284) para desplegar el menú principal con todas las aplicaciones
    await run('keyevent', 'Menú de aplicaciones', { keycode: 'KEYCODE_ALL_APPS', serial }, false);
  }, [serial, run]);
  const volumeUp = useCallback(() => sendKey('KEYCODE_VOLUME_UP'), [sendKey]);
  const volumeDown = useCallback(() => sendKey('KEYCODE_VOLUME_DOWN'), [sendKey]);
  const toggleMute = useCallback(() => sendKey('KEYCODE_VOLUME_MUTE'), [sendKey]);
  const mediaPlayPause = useCallback(() => sendKey('KEYCODE_MEDIA_PLAY_PAUSE'), [sendKey]);
  const togglePowerScreen = useCallback(() => sendKey('KEYCODE_POWER'), [sendKey]);
  const wakeScreen = useCallback(() => sendKey('KEYCODE_WAKEUP'), [sendKey]);
  const openSettings = useCallback(async () => {
    if (!serial) return;
    await run('adb_shell', 'Abrir Ajustes', { cmd: 'am start -a android.settings.SETTINGS', serial }, false);
  }, [serial, run]);

  const collapsePanels = useCallback(async () => {
    if (!serial) return;
    await run('adb_shell', 'Contraer Paneles', { cmd: 'cmd statusbar collapse', serial }, false);
  }, [serial, run]);

  const expandNotifications = useCallback(async () => {
    if (!serial) return;
    await run('adb_shell', 'Notificaciones', { cmd: 'cmd statusbar expand-notifications', serial }, false);
  }, [serial, run]);

  const expandQuickSettings = useCallback(async () => {
    if (!serial) return;
    await run('adb_shell', 'Ajustes rápidos', { cmd: 'cmd statusbar expand-settings', serial }, false);
  }, [serial, run]);

  // ── Orientation ──
  const setOrientation = useCallback(async (mode: 'auto' | 'portrait' | 'landscape') => {
    if (!serial) return;
    if (mode === 'auto') {
      await run('adb_shell', 'Auto rotación', { cmd: 'settings put system accelerometer_rotation 1', serial }, false);
    } else if (mode === 'portrait') {
      await run('adb_shell', 'Modo vertical', { cmd: 'settings put system accelerometer_rotation 0 && settings put system user_rotation 0', serial }, false);
    } else {
      await run('adb_shell', 'Modo horizontal', { cmd: 'settings put system accelerometer_rotation 0 && settings put system user_rotation 1', serial }, false);
    }
  }, [serial, run]);

  // ── Screenshot ──
  const screenshot = useCallback(async (): Promise<string | null> => {
    if (!serial) return null;
    try {
      const res = await run('screenshot', 'Capturando pantalla...', { serial });
      return res?.path || null;
    } catch {
      return null;
    }
  }, [serial, run]);

  // ── Power / Reboot ──
  const powerOff = useCallback(async () => {
    if (!serial) return;
    await run('power_off', 'Apagando dispositivo...', { serial });
  }, [serial, run]);

  const reboot = useCallback(async () => {
    if (!serial) return;
    await run('reboot', 'Reiniciando dispositivo...', { serial });
  }, [serial, run]);

  return {
    scrcpyActive,
    toggleScrcpy,
    scrcpyOptions,
    setScrcpyOptions,
    fullscreen,
    toggleFullscreen,
    sendKey,
    screenshot,
    isRecording,
    recordingSeconds,
    toggleRecord,
    powerOff,
    reboot,
    volumeUp,
    volumeDown,
    goBack,
    goHome,
    openRecent,
    openAllApps,
    togglePowerScreen,
    wakeScreen,
    toggleMute,
    mediaPlayPause,
    openSettings,
    collapsePanels,
    expandNotifications,
    expandQuickSettings,
    setOrientation,
    isBusy,
    connectAdb,
    isConnecting,
    autoProject,
    setAutoProject,
  };
}

