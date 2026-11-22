// ============================================================================
// ARCHIVO: hardware-usb-scan.ts
// QUÉ HACE: Escanea dispositivos USB conectados en Windows (Android offline/
//           bootloader y fallback Apple USB) con caché de 6 segundos.
// CÓMO FUNCIONA: Ejecuta `pnputil /enum-devices /connected` sobre `USB` y
//           `USBDevice` para detectar hardware incluso sin ADB autorizado.
// POR QUÉ: Separar el escaneo PnP de `/api/device/route.ts` (SRP, < 200L).
// ============================================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import type { DetectedDevice } from './device-detector';

const execAsync = promisify(exec);

let lastUsbScanTime = 0;
let cachedAndroidHardwareName: string | null = null;

/** Construye un DeviceInfo mínimo para dispositivos Android offline/unauthorized. */
export function buildOfflineDevice(target: DetectedDevice) {
  return {
    connected: true,
    connectionType: target.connectionType || 'USB',
    model: target.model || 'Dispositivo Android',
    androidVersion: target.state === 'unauthorized' ? 'Sin Autorización USB' : 'Modo Offline',
    serial: target.serial,
    ram: '--',
    storage: '--',
    battery: 0,
    isCharging: false,
    temperature: '--',
    state: target.state,
    oemUnlockAllowed: false,
    bootloaderLocked: true,
    verifiedBootState: 'unknown',
    vbmetaState: 'unknown',
  };
}

/** Detecta hardware Android en modo Bootloader/Fastboot cuando ADB no responde. */
export async function detectHardwareFallback() {
  const now = Date.now();
  if (now - lastUsbScanTime >= 6000) {
    lastUsbScanTime = now;
    try {
      const { stdout } = await execAsync('pnputil /enum-devices /connected /class USB', {
        windowsHide: true,
        timeout: 2000,
      });
      const text = String(stdout || '');
      if (/VID_22D9|VID_04E8|VID_18D1|VID_2717|VID_12D1|VID_0BB4|VID_2A70|Android|Fastboot|SAMSUNG Mobile|ADB/i.test(text)) {
        const match = text.match(/Descripci[óo]n del dispositivo:\s*(.+)/i);
        cachedAndroidHardwareName = match?.[1]
          ? match[1].replace(/Mobile|USB|CDC|Composite|Device|Modem|#\d+/ig, '').trim() || 'Dispositivo Hardware'
          : 'Dispositivo Android (USB)';
      } else {
        cachedAndroidHardwareName = null;
      }
    } catch {
      cachedAndroidHardwareName = null;
    }
  }

  if (!cachedAndroidHardwareName) return null;
  return {
    connected: true,
    devices: [{ serial: 'Hardware Level', model: cachedAndroidHardwareName, connectionType: 'USB', state: 'offline' }],
    activeDevice: {
      connected: true,
      connectionType: 'USB (Bootloader / Cargando)',
      model: cachedAndroidHardwareName,
      androidVersion: 'Modo Offline Especial',
      serial: 'Hardware Level',
      ram: '--',
      storage: '--',
      battery: 0,
      isCharging: true,
      temperature: '--',
      state: 'offline',
    },
  };
}
