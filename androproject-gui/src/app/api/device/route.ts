// ============================================================================
// ARCHIVO: /api/device/route.ts
// QUÉ HACE: Endpoint unificado de descubrimiento y telemetría de dispositivos
//           Android (ADB USB/Wi-Fi) e iOS (AirPlay 2 + USB vía pymobiledevice3).
// CÓMO FUNCIONA: Consulta en paralelo `DeviceDetector`, `airPlayReceiverEngine`
//           y `detectIosUsbDevices()`, devolviendo el listado unificado y el activo.
// POR QUÉ: Permitir detección automática simultánea de Android + iOS (< 200L).
// ============================================================================
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adb } from '@/lib/services/adb-executor';
import { DeviceDetector, DetectedDevice } from '@/lib/services/device-detector';
import { DeviceInfoFetcher } from '@/lib/services/device-info-fetcher';
import { airPlayReceiverEngine } from '@/lib/services/airplay-engine';
import { detectIosUsbDevices } from '@/lib/services/ios-usb-detector';
import { buildOfflineDevice, detectHardwareFallback } from '@/lib/services/hardware-usb-scan';

const NO_CACHE = { 'Cache-Control': 'no-store, max-age=0' };
const detector = new DeviceDetector(adb);
const fetcher = new DeviceInfoFetcher(adb);

function selectTarget(devices: DetectedDevice[], requestedSerial: string | null) {
  if (!requestedSerial) return devices[0];
  return devices.find((d) => d.serial === requestedSerial) || devices[0];
}

export async function GET(request: Request) {
  try {
    const requestedSerial = new URL(request.url).searchParams.get('serial');

    const [androidDevices, , iosUsbDevices] = await Promise.all([
      detector.detect(),
      airPlayReceiverEngine.getStatus().catch(() => null),
      detectIosUsbDevices().catch(() => []),
    ]);

    const airplayDevices = airPlayReceiverEngine.getConnectedDevices();
    const iosDevices = airplayDevices.length > 0 ? airplayDevices : iosUsbDevices;

    const allDetectedDeviceSummaries = [
      ...androidDevices.map((d) => ({ ...d, platform: 'android' as const })),
      ...iosDevices.map((d) => ({
        serial: d.serial,
        model: d.model || 'iPhone (iOS)',
        product: 'Apple iOS',
        transport_id: d.connectionType === 'USB' ? 'apple-usb' : 'airplay-wifi',
        connectionType: d.connectionType || 'Wi-Fi',
        state: 'device',
        platform: 'ios' as const,
      })),
    ];

    if (allDetectedDeviceSummaries.length === 0) {
      const fallback = await detectHardwareFallback();
      if (fallback) return NextResponse.json(fallback, { headers: NO_CACHE });
      return NextResponse.json({ connected: false, devices: [], activeDevice: null }, { headers: NO_CACHE });
    }

    if (requestedSerial && (requestedSerial.startsWith('airplay-') || requestedSerial.startsWith('apple-'))) {
      const iosMatch = iosDevices.find((d) => d.serial === requestedSerial);
      if (iosMatch) {
        return NextResponse.json({
          connected: true,
          devices: allDetectedDeviceSummaries,
          serialChanged: false,
          activeDevice: iosMatch,
        }, { headers: NO_CACHE });
      }
    }

    if (androidDevices.length === 0 && iosDevices.length > 0) {
      return NextResponse.json({
        connected: true,
        devices: allDetectedDeviceSummaries,
        serialChanged: requestedSerial && requestedSerial !== iosDevices[0].serial,
        activeDevice: iosDevices[0],
      }, { headers: NO_CACHE });
    }

    const target = selectTarget(androidDevices, requestedSerial);
    if (target.state !== 'device') {
      return NextResponse.json({
        connected: true,
        devices: allDetectedDeviceSummaries,
        serialChanged: requestedSerial && requestedSerial !== target.serial,
        activeDevice: { ...buildOfflineDevice(target), platform: 'android' },
      }, { headers: NO_CACHE });
    }

    const info = await fetcher.fetch(target.serial);
    if (!info) {
      return NextResponse.json({
        connected: true,
        devices: allDetectedDeviceSummaries,
        activeDevice: { ...buildOfflineDevice(target), platform: 'android' },
      }, { headers: NO_CACHE });
    }

    return NextResponse.json({
      connected: true,
      devices: allDetectedDeviceSummaries,
      serialChanged: requestedSerial && requestedSerial !== target.serial,
      activeDevice: { ...info, platform: 'android' },
    }, { headers: NO_CACHE });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Device API] Error:', message);
    return NextResponse.json({ connected: false, devices: [], activeDevice: null, error: message }, { status: 200, headers: NO_CACHE });
  }
}
