/**
 * Device Detector — Discovers connected Android devices.
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

export class DeviceDetector implements IDeviceDetector {
  constructor(private adb: IAdbExecutor) {}

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

      const isWifi = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\b/.test(serial);
      devices.push({ serial, state, model, connectionType: isWifi ? 'Wi-Fi' : 'USB' });
    }

    return devices;
  }

  async isReady(serial: string): Promise<boolean> {
    const devices = await this.detect();
    const device = devices.find(d => d.serial === serial);
    return device?.state === 'device';
  }
}
