// ============================================================================
// ARCHIVO: useProjectionActions.ts
// QUÉ HACE: Encapsula las acciones de control remoto, teclas, orientación,
//           captura de pantalla y energía para el dispositivo proyectado.
// CÓMO FUNCIONA: Envía comandos `keyevent`, `adb_shell`, `screenshot`,
//           `power_off` y `reboot` a `/api/actions` mediante `run`, protegiendo
//           acciones exclusivas de Android cuando el dispositivo es iOS.
// POR QUÉ: Extraer las acciones atómicas mantiene useProjection.ts bajo 200
//           líneas con separación clara de responsabilidades (SRP / SOLID).
// ============================================================================

'use client';

import { useCallback } from 'react';

type RunFn = (
  action: string,
  desc: string,
  extraBody?: Record<string, unknown>,
  logResult?: boolean,
) => Promise<any>;

export function useProjectionActions(serial: string | undefined, isIos: boolean, run: RunFn) {
  /** Envía un keyevent genérico (Home, Back, Volumen, Power, etc.). */
  const sendKey = useCallback(async (keycode: string) => {
    if (!serial) return;
    await run('keyevent', '', { keycode, serial }, false);
  }, [serial, run]);

  const goBack = useCallback(() => sendKey('KEYCODE_BACK'), [sendKey]);
  const goHome = useCallback(() => sendKey('KEYCODE_HOME'), [sendKey]);
  const openRecent = useCallback(() => sendKey('KEYCODE_APP_SWITCH'), [sendKey]);
  const openAllApps = useCallback(async () => {
    if (!serial) return;
    await run('keyevent', 'Menú de aplicaciones', { keycode: 'KEYCODE_ALL_APPS', serial }, false);
  }, [serial, run]);

  const volumeUp = useCallback(() => sendKey('KEYCODE_VOLUME_UP'), [sendKey]);
  const volumeDown = useCallback(() => sendKey('KEYCODE_VOLUME_DOWN'), [sendKey]);
  const toggleMute = useCallback(() => sendKey('KEYCODE_VOLUME_MUTE'), [sendKey]);
  const mediaPlayPause = useCallback(() => sendKey('KEYCODE_MEDIA_PLAY_PAUSE'), [sendKey]);
  const togglePowerScreen = useCallback(() => sendKey('KEYCODE_POWER'), [sendKey]);
  const wakeScreen = useCallback(() => sendKey('KEYCODE_WAKEUP'), [sendKey]);

  const openSettings = useCallback(async () => {
    if (!serial || isIos) return;
    await run('adb_shell', 'Abrir Ajustes', { cmd: 'am start -a android.settings.SETTINGS', serial }, false);
  }, [serial, isIos, run]);

  const collapsePanels = useCallback(async () => {
    if (!serial || isIos) return;
    await run('adb_shell', 'Contraer Paneles', { cmd: 'cmd statusbar collapse', serial }, false);
  }, [serial, isIos, run]);

  const expandNotifications = useCallback(async () => {
    if (!serial || isIos) return;
    await run('adb_shell', 'Notificaciones', { cmd: 'cmd statusbar expand-notifications', serial }, false);
  }, [serial, isIos, run]);

  const expandQuickSettings = useCallback(async () => {
    if (!serial || isIos) return;
    await run('adb_shell', 'Ajustes rápidos', { cmd: 'cmd statusbar expand-settings', serial }, false);
  }, [serial, isIos, run]);

  /** Cambia rotación automática o fija vertical/horizontal vía settings ADB. */
  const setOrientation = useCallback(async (mode: 'auto' | 'portrait' | 'landscape') => {
    if (!serial || isIos) return;
    if (mode === 'auto') {
      await run('adb_shell', 'Auto rotación', { cmd: 'settings put system accelerometer_rotation 1', serial }, false);
    } else if (mode === 'portrait') {
      await run('adb_shell', 'Modo vertical', { cmd: 'settings put system accelerometer_rotation 0 && settings put system user_rotation 0', serial }, false);
    } else {
      await run('adb_shell', 'Modo horizontal', { cmd: 'settings put system accelerometer_rotation 0 && settings put system user_rotation 1', serial }, false);
    }
  }, [serial, isIos, run]);

  /** Toma una captura HD PNG y devuelve su ruta local o null si falló. */
  const screenshot = useCallback(async (): Promise<string | null> => {
    if (!serial) return null;
    try {
      const res = await run('screenshot', 'Capturando pantalla...', { serial });
      return res?.success && res?.path ? res.path : null;
    } catch {
      return null;
    }
  }, [serial, run]);

  const powerOff = useCallback(async () => {
    if (!serial || isIos) return;
    await run('power_off', 'Apagando dispositivo...', { serial });
  }, [serial, isIos, run]);

  const reboot = useCallback(async () => {
    if (!serial || isIos) return;
    await run('reboot', 'Reiniciando dispositivo...', { serial });
  }, [serial, isIos, run]);

  return {
    sendKey, goBack, goHome, openRecent, openAllApps,
    volumeUp, volumeDown, toggleMute, mediaPlayPause,
    togglePowerScreen, wakeScreen, openSettings,
    collapsePanels, expandNotifications, expandQuickSettings,
    setOrientation, screenshot, powerOff, reboot,
  };
}
