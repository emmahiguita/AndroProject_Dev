// ============================================================================
// ARCHIVO: ios-usb-detector.ts
// QUÉ HACE: Detecta dispositivos iOS (iPhone/iPad) conectados por USB en Windows
//           leyendo metadatos reales vía `pymobiledevice3 usbmux list` y `pnputil`.
// CÓMO FUNCIONA: Cachea el escaneo 6s para no frenar el polling de `/api/device`
//           y construye un `DeviceInfo` unificado con nombre, modelo y versión iOS.
// POR QUÉ: En Windows 11 Apple usa clase `USBDevice` (no `USB`); aislar esta
//           lógica mantiene `/api/device/route.ts` limpio y bajo 200 líneas (SRP).
// ============================================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import type { DeviceInfo } from '@/features/types';

const execAsync = promisify(exec);

interface UsbmuxEntry {
  DeviceName?: string;
  ProductType?: string;
  ProductVersion?: string;
  UniqueDeviceID?: string;
  ConnectionType?: string;
}

let lastIosScanTs = 0;
let cachedIosUsb: DeviceInfo[] = [];

/** Detecta iPhones/iPads conectados por USB en Windows con caché de 6 segundos. */
export async function detectIosUsbDevices(): Promise<DeviceInfo[]> {
  const now = Date.now();
  if (now - lastIosScanTs < 6000) return cachedIosUsb;
  lastIosScanTs = now;

  try {
    const { stdout } = await execAsync('python -m pymobiledevice3 usbmux list', {
      windowsHide: true,
      timeout: 3000,
    });
    const parsed = JSON.parse(String(stdout || '[]')) as UsbmuxEntry[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      cachedIosUsb = parsed
        .filter((d) => !d.ConnectionType || d.ConnectionType === 'USB')
        .map((d) => ({
          connected: true,
          platform: 'ios',
          connectionType: 'USB',
          model: d.DeviceName ? `${d.DeviceName} (${d.ProductType || 'iPhone'})` : (d.ProductType || 'Apple iPhone (USB)'),
          serial: d.UniqueDeviceID ? `apple-${d.UniqueDeviceID}` : 'apple-usb-device',
          iosVersion: d.ProductVersion ? `iOS ${d.ProductVersion}` : 'iOS',
          resolution: '1179 × 2556',
          state: 'device',
          airplayClientName: d.DeviceName || 'iPhone',
          airplayResolution: '1179 × 2556',
          airplayFps: 60,
          airplayAudioEnabled: false,
        }));
      return cachedIosUsb;
    }
  } catch {
    // Fallback rápido por clase USBDevice de Windows si pymobiledevice3 no responde
  }

  try {
    const { stdout } = await execAsync('pnputil /enum-devices /connected /class USBDevice', {
      windowsHide: true,
      timeout: 2000,
    });
    if (/VID_05AC/i.test(String(stdout || ''))) {
      cachedIosUsb = [{
        connected: true, platform: 'ios', connectionType: 'USB',
        model: 'Apple iPhone (USB Conectado)', serial: 'apple-usb-device',
        iosVersion: 'iOS', resolution: '1179 × 2556', state: 'device',
        airplayClientName: 'iPhone', airplayResolution: '1179 × 2556',
        airplayFps: 60, airplayAudioEnabled: false,
      }];
      return cachedIosUsb;
    }
  } catch {}

  cachedIosUsb = [];
  return cachedIosUsb;
}
