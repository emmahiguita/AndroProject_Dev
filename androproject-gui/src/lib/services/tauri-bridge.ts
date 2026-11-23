// ============================================================================
// ARCHIVO: tauri-bridge.ts
// QUÉ HACE: Puente DIP liviano entre el frontend React y los comandos nativos
//           en Rust de Tauri (con fallback transparente en navegador web).
// CÓMO FUNCIONA: Detecta `window.__TAURI_INTERNALS__` e invoca comandos Rust
//           (`launch_scrcpy_native`, `adb_list_devices_fast`, `list_avds`, etc.).
// POR QUÉ: Acelerar acciones en escritorio Rust sin acoplar la UI a Tauri.
// ============================================================================

interface TauriInternals {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
}

function getTauri(): TauriInternals | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __TAURI_INTERNALS__?: TauriInternals };
  return w.__TAURI_INTERNALS__ ?? null;
}

export function isTauriDesktop(): boolean {
  return getTauri() !== null;
}

export async function invokeRust<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  const tauri = getTauri();
  if (!tauri) return null;
  try {
    return await tauri.invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

export interface NativeAppInfo {
  package_name: string;
  is_system: boolean;
  is_disabled: boolean;
}

export interface NativeDeviceMetrics {
  serial: string;
  android_version: string;
  battery_level: number;
  screen_size: string;
}

export const rustBridge = {
  isDesktop: isTauriDesktop,
  listAvds: () => invokeRust<string[]>('list_avds'),
  launchAvd: (avd: string, port = 5554) => invokeRust<string>('launch_avd', { avd, port }),
  launchScrcpy: (serial: string, maxFps = 60, maxSize = 1280, bitrate = '8M') =>
    invokeRust<string>('launch_scrcpy_native', { serial, maxFps, maxSize, bitrate }),
  launchMultiScrcpy: (serials: string[]) =>
    invokeRust<number>('launch_multi_scrcpy_native', { serials }),
  openPopout: (serial: string) => invokeRust<void>('open_device_popout', { serial }),
  sendKeyFast: (serial: string, keycode: string) =>
    invokeRust<boolean>('adb_key_fast', { serial, keycode }),
  listPackagesFast: (serial: string) =>
    invokeRust<NativeAppInfo[]>('rust_list_packages_fast', { serial }),
  appActionFast: (
    serial: string,
    packageName: string,
    action: 'uninstall' | 'disable' | 'enable' | 'force_stop' | 'clear_data' | 'launch'
  ) => {
    // La acción puede ser irreversible: propaga el error para no ejecutarla dos veces.
    const tauri = getTauri();
    return tauri ? tauri.invoke<string>('rust_app_action_fast', { serial, packageName, action }) : Promise.resolve(null);
  },
  logcatSnapshot: (serial: string, lines = 150, filter?: string) =>
    invokeRust<string[]>('rust_logcat_snapshot', { serial, lines, filter }),
  logcatClear: (serial: string) => invokeRust<boolean>('rust_logcat_clear', { serial }),
  deviceMetricsFast: (serial: string) =>
    invokeRust<NativeDeviceMetrics>('rust_device_metrics_fast', { serial }),
};
