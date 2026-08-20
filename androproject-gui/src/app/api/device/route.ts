/**
 * /api/device — Device detection + info endpoint.
 * SOLID: SRP (orchestrates services, no business logic), DIP (uses interfaces).
 *
 * Before: 302-line god function doing everything.
 * After: Thin orchestrator that delegates to focused services.
 */
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adb } from '@/lib/services/adb-executor';
import { DeviceDetector, DetectedDevice } from '@/lib/services/device-detector';
import { DeviceInfoFetcher } from '@/lib/services/device-info-fetcher';

const detector = new DeviceDetector(adb);
const fetcher = new DeviceInfoFetcher(adb);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedSerial = searchParams.get('serial');

    // 1. Discover connected devices
    const devices = await detector.detect();

    if (devices.length === 0) {
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

    // 2. Select target device
    const target = selectTarget(devices, requestedSerial);

    // 3. If device is not ready, return minimal info
    if (target.state !== 'device') {
      return NextResponse.json({
        connected: true,
        devices,
        serialChanged: requestedSerial && requestedSerial !== target.serial,
        activeDevice: buildOfflineDevice(target),
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    // 4. Fetch full device info
    const info = await fetcher.fetch(target.serial);
    if (!info) {
      return NextResponse.json({
        connected: true,
        devices,
        activeDevice: buildOfflineDevice(target),
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    return NextResponse.json({
      connected: true,
      devices,
      serialChanged: requestedSerial && requestedSerial !== target.serial,
      activeDevice: info,
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

async function detectHardwareFallback() {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const psScript = `Get-PnpDevice -PresentOnly | Where-Object FriendlyName -match 'Android|Fastboot|SAMSUNG Mobile|ADB' | Where-Object Class -match 'USB|Modem|AndroidUsbDeviceClass' | Select-Object -ExpandProperty FriendlyName -First 1`;
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript}"`, { timeout: 4000 });
    const hwName = stdout.trim();

    if (!hwName) return null;

    const cleanName = hwName.replace(/Mobile|USB|CDC|Composite|Device|Modem|#\\d+/ig, '').trim() || 'Dispositivo Hardware';
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
