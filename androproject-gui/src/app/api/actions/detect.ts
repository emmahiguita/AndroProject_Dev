import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';

const execAsync = promisify(exec);

interface DeviceInfo {
  serial: string; model: string; connectionType: string; state: string;
}

interface ParsedDevice {
  connected: boolean;
  connectionType: string;
  model: string;
  androidVersion: string;
  serial: string;
  ram: string;
  storage: string;
  battery: number;
  isCharging: boolean;
  temperature: string;
  state: string;
  oemUnlockAllowed: boolean;
  bootloaderLocked: boolean;
  verifiedBootState: string;
  vbmetaState: string;
}

// ── Utility: collect all connected devices ────────────────────────
async function listDevices(): Promise<DeviceInfo[]> {
  const { stdout } = await execAsync(`"${ADB}" devices -l`, { timeout: 3000 });
  const lines = stdout.trim().split('\n').slice(1);
  const devices: DeviceInfo[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const serial = parts[0];
    const state = parts[1];
    if (!['device', 'offline', 'unauthorized', 'recovery', 'sideload'].includes(state)) continue;

    let model = 'Dispositivo';
    const modelMatch = line.match(/model:(\S+)/);
    if (modelMatch) { model = modelMatch[1].replace(/_/g, ' '); }
    else { model = `Dispositivo (${state})`; }

    const isWifi = !!serial.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\b/);
    devices.push({ serial, model, connectionType: isWifi ? 'Wi-Fi' : 'USB', state });
  }
  return devices;
}

// ── Utility: deduplicate devices (prefer Wi-Fi) ──────────────────
function deduplicate(list: DeviceInfo[]): DeviceInfo[] {
  const unique = new Map<string, DeviceInfo>();
  for (const d of list) {
    const existing = unique.get(d.model);
    if (!existing || (d.connectionType === 'Wi-Fi' && existing.connectionType !== 'Wi-Fi')) {
      unique.set(d.model, d);
    }
  }
  return Array.from(unique.values()).sort((a, b) => {
    if (a.connectionType === 'Wi-Fi' && b.connectionType !== 'Wi-Fi') return -1;
    if (b.connectionType === 'Wi-Fi' && a.connectionType !== 'Wi-Fi') return 1;
    return 0;
  });
}

// ── Utility: fetch detailed properties for a device ───────────────
async function fetchDeviceDetails(serial: string, connectionType: string): Promise<ParsedDevice> {
  const adbTarget = `"${ADB}" -s ${serial}`;

  // Properties
  const { stdout: propOut } = await execAsync(`${adbTarget} shell getprop`, { timeout: 3000 });
  const props: Record<string, string> = {};
  for (const line of propOut.split('\n')) {
    const m = line.match(/^\[(.*?)\]: \[(.*?)\]/);
    if (m) props[m[1]] = m[2];
  }

  // Battery
  const { stdout: batOut } = await execAsync(`${adbTarget} shell dumpsys battery`, { timeout: 2000 });
  let battery = 0, tempRaw = 0, isCharging = false;
  for (const line of batOut.split('\n')) {
    if (line.includes('level:')) battery = parseInt(line.split(':')[1]);
    if (line.includes('temperature:')) tempRaw = parseInt(line.split(':')[1]);
    if (line.includes('status:')) {
      const s = line.split(':')[1].trim();
      if (s === '2' || s === '5') isCharging = true;
    }
  }

  // RAM
  const { stdout: memOut } = await execAsync(`${adbTarget} shell cat /proc/meminfo`, { timeout: 2000 });
  let totalMemKB = 0;
  for (const line of memOut.split('\n')) {
    if (line.startsWith('MemTotal:')) totalMemKB = parseInt(line.replace(/[^0-9]/g, ''));
  }

  // Storage
  let storage = '128 GB';
  try {
    const { stdout: dfOut } = await execAsync(`${adbTarget} shell df -h /data`, { timeout: 2000 });
    const cols = dfOut.trim().split('\n')[1]?.trim().split(/\s+/);
    if (cols?.length >= 2) {
      const rawSize = parseFloat(cols[1].replace(/[^0-9.]/g, ''));
      const standards = [8, 16, 32, 64, 128, 256, 512, 1024];
      let best = standards[0];
      for (const s of standards) { if (rawSize <= s * 0.98) { best = s; break; } }
      if (rawSize > 1000) best = Math.ceil(rawSize);
      storage = `${best} GB`;
    }
  } catch { /* default */ }

  // Model name
  const rawModel = props['ro.product.model'] || serial;
  const marketName = props['ro.product.marketname'] || props['ro.vendor.oplus.market.name'] || props['bluetooth.device.default_name'] || rawModel;
  const model = (marketName !== rawModel && rawModel !== 'Dispositivo') ? `${marketName} (${rawModel})` : marketName;

  return {
    connected: true, connectionType,
    model, serial,
    androidVersion: props['ro.build.version.release'] || 'Unknown',
    ram: `${Math.round(totalMemKB / 1024 / 1024)} GB`,
    storage, battery, isCharging,
    temperature: tempRaw > 0 ? (tempRaw / 10).toFixed(1) : '--',
    state: 'device',
    oemUnlockAllowed: props['sys.oem_unlock_allowed'] === '1',
    bootloaderLocked: props['ro.boot.flash.locked'] !== '0',
    verifiedBootState: props['ro.boot.verifiedbootstate'] || 'unknown',
    vbmetaState: props['ro.boot.vbmeta.device_state'] || 'unknown',
  };
}

// ── Handler ───────────────────────────────────────────────────────
export async function detect(_body?: Record<string, unknown>) {
  try {
    const devices = await listDevices();
    if (devices.length === 0) {
      return NextResponse.json(
        { success: true, connected: false, devices: [], device: null },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } },
      );
    }

    const uniqueDevices = deduplicate(devices);
    const target = uniqueDevices[0];

    if (target.state !== 'device') {
      return NextResponse.json({
        success: true, connected: true,
        devices: uniqueDevices,
        device: {
          connected: true, connectionType: target.connectionType,
          model: target.state === 'unauthorized' ? `${target.model} (No Autorizado)` : `${target.model} (Offline)`,
          androidVersion: 'Requiere Autorización', serial: target.serial,
          ram: '--', storage: '--', battery: 0, isCharging: false,
          temperature: '--', state: target.state,
          oemUnlockAllowed: false, bootloaderLocked: true,
          verifiedBootState: 'unknown', vbmetaState: 'unknown',
        },
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    const detail = await fetchDeviceDetails(target.serial, target.connectionType);
    return NextResponse.json({
      success: true, connected: true,
      devices: uniqueDevices,
      device: detail,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });

  } catch (err: unknown) {
    return NextResponse.json({
      success: true, connected: false, devices: [], device: null,
      error: err instanceof Error ? err.message : String(err),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
