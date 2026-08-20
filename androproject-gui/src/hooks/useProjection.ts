// ── useProjection — projection page business logic ──────────
// SRP: manages scrcpy lifecycle, fullscreen, ADB key commands,
//      screenshot, power off. Stats come from device prop (no duplicate polling).
// NOTE: every action passes `serial: device.serial` explicitly so buttons
//       always target the device shown on screen, even if the store's
//       activeSerial is out of sync.

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useActions } from './useActions';
import type { DeviceInfo } from '@/features/types';

interface UseProjectionReturn {
  scrcpyActive: boolean;
  toggleScrcpy: () => Promise<void>;
  fullscreen: boolean;
  toggleFullscreen: () => Promise<void>;
  sendKey: (keycode: string) => Promise<void>;
  screenshot: () => Promise<string | null>;
  powerOff: () => Promise<void>;
  reboot: () => Promise<void>;
  volumeUp: () => Promise<void>;
  volumeDown: () => Promise<void>;
  goBack: () => Promise<void>;
  goHome: () => Promise<void>;
  openRecent: () => Promise<void>;
  isBusy: boolean;
}

export function useProjection(device: DeviceInfo | null | undefined): UseProjectionReturn {
  const { run } = useActions();
  const [scrcpyActive, setScrcpyActive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // The serial this view is bound to — every action targets it explicitly.
  const serial = device?.serial ?? undefined;

  // ── Check scrcpy status on mount ──
  useEffect(() => {
    if (!serial) return;
    let isMounted = true;
    run('check_screen', '', { serial }, false).then((res: any) => {
      if (isMounted) setScrcpyActive(res?.alive || false);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [serial, run]);

  // ── Scrcpy lifecycle ──
  const toggleScrcpy = useCallback(async () => {
    if (!serial) return;
    setIsBusy(true);
    try {
      if (scrcpyActive) {
        await run('stop_screen', 'Deteniendo scrcpy', { serial });
        setScrcpyActive(false);
      } else {
        await run('open_screen', 'Iniciando scrcpy...', { serial });
        setScrcpyActive(true);
      }
    } finally {
      setIsBusy(false);
    }
  }, [scrcpyActive, serial, run]);

  // ── Fullscreen ──
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      await document.exitFullscreen();
      setFullscreen(false);
    }
  }, []);

  // ── ADB key commands ──
  const sendKey = useCallback(async (keycode: string) => {
    if (!serial) return;
    await run('keyevent', '', { keycode, serial }, false);
  }, [serial, run]);

  const goBack = useCallback(() => sendKey('KEYCODE_BACK'), [sendKey]);
  const goHome = useCallback(() => sendKey('KEYCODE_HOME'), [sendKey]);
  const openRecent = useCallback(() => sendKey('KEYCODE_APP_SWITCH'), [sendKey]);
  const volumeUp = useCallback(() => sendKey('KEYCODE_VOLUME_UP'), [sendKey]);
  const volumeDown = useCallback(() => sendKey('KEYCODE_VOLUME_DOWN'), [sendKey]);

  // ── Screenshot ──
  const screenshot = useCallback(async (): Promise<string | null> => {
    if (!serial) return null;
    try {
      const res = await run('screenshot', 'Capturando pantalla', { serial }, false);
      return res?.path || null;
    } catch {
      return null;
    }
  }, [serial, run]);

  // ── Power off ──
  const powerOff = useCallback(async () => {
    if (!serial) return;
    await run('power_off', 'Apagando dispositivo', { serial });
  }, [serial, run]);

  // ── Reboot ──
  const reboot = useCallback(async () => {
    if (!serial) return;
    await run('reboot', 'Reiniciando dispositivo', { serial });
  }, [serial, run]);

  return {
    scrcpyActive,
    toggleScrcpy,
    fullscreen,
    toggleFullscreen,
    sendKey,
    screenshot,
    powerOff,
    reboot,
    volumeUp,
    volumeDown,
    goBack,
    goHome,
    openRecent,
    isBusy,
  };
}
