/**
 * Device Detector — Discovers connected Android devices and deduplicates USB + Wi-Fi
 * connections pointing to the same physical `ro.serialno` (prioritizing USB).
 * SOLID: SRP (only discovers devices), DIP (depends on IAdbExecutor).
 */
import { IAdbExecutor } from './adb-executor';

export interface DetectedDevice {
  serial: string;
  state: 'device' | 'offline' | 'unauthorized' | 'recovery' | 'sideload';
  model: string;
  connectionType: 'USB' | 'Wi-Fi';
}

export interface IDeviceDetector {
  /** Detect all connected devices */
  detect(): Promise<DetectedDevice[]>;
  /** Check if a specific device is connected and ready */
  isReady(serial: string): Promise<boolean>;
}

const serialNoCache = new Map<string, string>();

export class DeviceDetector implements IDeviceDetector {
  constructor(private adb: IAdbExecutor) {}

  private async getHardwareSerial(serial: string): Promise<string> {
    const cached = serialNoCache.get(serial);
    if (cached) return cached;
    const res = await this.adb.execFor(serial, 'shell getprop ro.serialno', 2000);
    const hw = res.ok ? res.out.trim() : '';
    if (hw) serialNoCache.set(serial, hw);
    return hw || serial;
  }

  async detect(): Promise<DetectedDevice[]> {
    const result = await this.adb.exec('devices -l', 5000);
    if (!result.ok) return [];

    const lines = result.out.trim().split('\n').slice(1);
    const devices: DetectedDevice[] = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;

      const serial = parts[0];
      const state = parts[1] as DetectedDevice['state'];
      if (!['device', 'offline', 'unauthorized', 'recovery', 'sideload'].includes(state)) continue;

      let model = 'Dispositivo';
      const modelMatch = line.match(/model:(\S+)/);
      if (modelMatch) model = modelMatch[1].replace(/_/g, ' ');

      const isWifi = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\b/.test(serial)
        || serial.includes('_adb-tls-connect')
        || serial.startsWith('adb-');
      devices.push({ serial, state, model, connectionType: isWifi ? 'Wi-Fi' : 'USB' });
    }

    // Deduplica cuando un mismo equipo físico aparece por USB y Wi-Fi ADB simultáneamente
    const ready = devices.filter((d) => d.state === 'device');
    if (ready.length <= 1) return devices;

    const hwPairs = await Promise.all(ready.map(async (d) => [d.serial, await this.getHardwareSerial(d.serial)] as const));
    const hwMap = new Map<string, string>(hwPairs);
    const sorted = [...devices].sort((a, b) => (a.connectionType === 'USB' ? 0 : 1) - (b.connectionType === 'USB' ? 0 : 1));
    const seenHw = new Set<string>();
    return sorted.filter((d) => {
      const key = (d.state === 'device' ? hwMap.get(d.serial) : undefined) || d.serial;
      if (seenHw.has(key)) return false;
      seenHw.add(key);
      return true;
    });
  }

  async isReady(serial: string): Promise<boolean> {
    const devices = await this.detect();
    const device = devices.find(d => d.serial === serial);
    return device?.state === 'device';
  }
}
