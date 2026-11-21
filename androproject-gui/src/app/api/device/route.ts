/**
 * /api/device — Device detection + info endpoint.
 * SOLID: SRP (orchestrates services, no business logic), DIP (uses interfaces).
 *
 * Before: 302-line god function doing everything.
 * After: Thin orchestrator that delegates to focused services.
 */
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { adb } from '@/lib/services/adb-executor';
import { DeviceDetector, DetectedDevice } from '@/lib/services/device-detector';
import { DeviceInfoFetcher } from '@/lib/services/device-info-fetcher';
import { airPlayReceiverEngine } from '@/lib/services/airplay-engine';

const execAsync = promisify(exec);

const detector = new DeviceDetector(adb);
const fetcher = new DeviceInfoFetcher(adb);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedSerial = searchParams.get('serial');

    // 1. Discover connected Android devices + active iOS AirPlay clients (refresh live sockets first)
    const [androidDevices] = await Promise.all([
      detector.detect(),
      airPlayReceiverEngine.getStatus().catch(() => null),
    ]);
    let iosDevices = airPlayReceiverEngine.getConnectedDevices();

    // Check hardware USB if no AirPlay sessions or no Android devices detected
    if (iosDevices.length === 0 || androidDevices.length === 0) {
      const hw = await scanHardwareUsb();
      if (iosDevices.length === 0 && hw.hasAppleUsb) {
        iosDevices = [
          {
            connected: true,
            platform: 'ios',
            connectionType: 'USB',
            model: 'Apple iPhone (USB Conectado)',
            serial: 'apple-usb-device',
            iosVersion: 'iOS',
            resolution: '1179 × 2556',
            state: 'device',
            airplayClientName: 'iPhone',
            airplayResolution: '1179 × 2556',
            airplayFps: 60,
            airplayAudioEnabled: false,
          },
        ];
      }
    }

    const allDetectedDeviceSummaries = [
      ...androidDevices.map(d => ({ ...d, platform: 'android' as const })),
      ...iosDevices.map(d => ({
        serial: d.serial,
        model: d.model || 'iPhone (AirPlay)',
        product: 'Apple iOS',
        transport_id: 'airplay-wifi',
        connectionType: d.connectionType || 'Wi-Fi',
        state: 'device',
        platform: 'ios' as const,
      })),
    ];

    if (allDetectedDeviceSummaries.length === 0) {
      // Hardware fallback: check for USB devices in bootloader/offline state
      const fallback = await detectHardwareFallback();
      if (fallback) {
        return NextResponse.json(fallback, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
      }
      return NextResponse.json(
        { connected: false, devices: [], activeDevice: null },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } },
      );
    }

    // Check if an iOS AirPlay device was requested
    if (requestedSerial?.startsWith('airplay-')) {
      const iosMatch = iosDevices.find(d => d.serial === requestedSerial);
      if (iosMatch) {
        return NextResponse.json({
          connected: true,
          devices: allDetectedDeviceSummaries,
          serialChanged: false,
          activeDevice: iosMatch,
        }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
      }
    }

    // 2. Select target device from Android devices if available, else first iOS
    if (androidDevices.length === 0 && iosDevices.length > 0) {
      return NextResponse.json({
        connected: true,
        devices: allDetectedDeviceSummaries,
        serialChanged: requestedSerial && requestedSerial !== iosDevices[0].serial,
        activeDevice: iosDevices[0],
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    const target = selectTarget(androidDevices, requestedSerial);

    // 3. If device is not ready, return minimal info
    if (target.state !== 'device') {
      return NextResponse.json({
        connected: true,
        devices: allDetectedDeviceSummaries,
        serialChanged: requestedSerial && requestedSerial !== target.serial,
        activeDevice: { ...buildOfflineDevice(target), platform: 'android' },
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    // 4. Fetch full device info
    const info = await fetcher.fetch(target.serial);
    if (!info) {
      return NextResponse.json({
        connected: true,
        devices: allDetectedDeviceSummaries,
        activeDevice: { ...buildOfflineDevice(target), platform: 'android' },
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    return NextResponse.json({
      connected: true,
      devices: allDetectedDeviceSummaries,
      serialChanged: requestedSerial && requestedSerial !== target.serial,
      activeDevice: { ...info, platform: 'android' },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Device API] Error:', message);
    return NextResponse.json(
      { connected: false, devices: [], activeDevice: null, error: message },
      { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }
}

// ── Helpers (pure functions, testable) ────────────────────────

function selectTarget(
  devices: DetectedDevice[],
  requestedSerial: string | null,
) {
  if (!requestedSerial) return devices[0];
  const found = devices.find((d: DetectedDevice) => d.serial === requestedSerial);
  return found || devices[0];
}

function buildOfflineDevice(target: { serial: string; model: string; state: string; connectionType: string }) {
  const label = target.state === 'unauthorized'
    ? `${target.model} (No Autorizado)`
    : target.state === 'offline'
      ? `${target.model} (Offline)`
      : target.model;

  return {
    connected: true,
    connectionType: target.connectionType,
    model: label,
    androidVersion: 'Requiere Autorizacion',
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

interface HardwareUsbScan {
  hasAppleUsb: boolean;
  androidHardwareName: string | null;
}

let lastUsbScanTime = 0;
let cachedUsbScan: HardwareUsbScan = { hasAppleUsb: false, androidHardwareName: null };

async function scanHardwareUsb(): Promise<HardwareUsbScan> {
  const now = Date.now();
  if (now - lastUsbScanTime < 6000) {
    return cachedUsbScan;
  }
  lastUsbScanTime = now;

  try {
    const { stdout } = await execAsync('pnputil /enum-devices /connected /class USB', {
      windowsHide: true,
      timeout: 2000,
    });

    const text = String(stdout || '');
    const hasAppleUsb = /VID_05AC/i.test(text);

    let androidHardwareName: string | null = null;
    if (/VID_22D9|VID_04E8|VID_18D1|VID_2717|VID_12D1|VID_0BB4|VID_2A70|Android|Fastboot|SAMSUNG Mobile|ADB/i.test(text)) {
      const match = text.match(/Descripci[óo]n del dispositivo:\s*(.+)/i);
      if (match && match[1]) {
        androidHardwareName = match[1].replace(/Mobile|USB|CDC|Composite|Device|Modem|#\d+/ig, '').trim() || 'Dispositivo Hardware';
      } else {
        androidHardwareName = 'Dispositivo Android (USB)';
      }
    }

    cachedUsbScan = { hasAppleUsb, androidHardwareName };
    return cachedUsbScan;
  } catch {
    return cachedUsbScan;
  }
}

async function detectHardwareFallback() {
  try {
    const hw = await scanHardwareUsb();
    if (!hw.androidHardwareName) return null;

    const cleanName = hw.androidHardwareName;
    return {
      connected: true,
      devices: [{ serial: 'Hardware Level', model: cleanName, connectionType: 'USB', state: 'offline' }],
      activeDevice: {
        connected: true,
        connectionType: 'USB (Bootloader / Cargando)',
        model: cleanName,
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
  } catch {
    return null;
  }
}
