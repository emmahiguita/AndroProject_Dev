/**
 * Device Info Fetcher — Retrieves full device properties.
 * SOLID: SRP (only fetches device info), DIP (depends on IAdbExecutor).
 */
import { IAdbExecutor } from './adb-executor';

export interface DeviceInfo {
  serial: string;
  model: string;
  marketName: string;
  androidVersion: string;
  resolution: string;
  connectionType: 'USB' | 'Wi-Fi';
  state: string;
  // Hardware
  ram: string;
  ramUsed: string;
  ramUsagePercent: number;
  storage: string;
  storageUsedGB: number;
  storageFreeGB: number;
  storageUsagePercent: number;
  cpuUsagePercent: number;
  // Power
  battery: number;
  isCharging: boolean;
  temperature: string;
  // Security
  oemUnlockAllowed: boolean;
  bootloaderLocked: boolean;
  verifiedBootState: string;
  vbmetaState: string;
}

export interface IDeviceInfoFetcher {
  /** Fetch complete device info for a connected device */
  fetch(serial: string): Promise<DeviceInfo | null>;
}

export class DeviceInfoFetcher implements IDeviceInfoFetcher {
  constructor(private adb: IAdbExecutor) {}

  async fetch(serial: string): Promise<DeviceInfo | null> {
    // Verify device is ready
    const check = await this.adb.execFor(serial, 'get-state', 3000);
    if (!check.ok || !check.out.trim().includes('device')) return null;

    // Fetch all properties in parallel
    const [propsResult, batteryResult, memResult, cpuResult, dfResult, sizeResult] = await Promise.all([
      this.adb.execFor(serial, 'shell getprop', 3000),
      this.adb.execFor(serial, 'shell dumpsys battery', 2000),
      this.adb.execFor(serial, 'shell cat /proc/meminfo', 2000),
      this.adb.shell(serial, 'cat /proc/stat | head -1', 1500),
      this.adb.execFor(serial, 'shell df -h /data', 2000),
      this.adb.execFor(serial, 'shell wm size', 2000),
    ]);

    // Parse properties
    const props = this.parseProperties(propsResult.out);

    // Parse battery
    const battery = this.parseBattery(batteryResult.out);

    // Parse RAM
    const ram = this.parseRam(memResult.out);

    // Parse CPU
    const cpu = this.parseCpu(cpuResult.out);

    // Parse storage
    const storage = this.parseStorage(dfResult.out);

    // Parse resolution
    const resolution = this.parseResolution(sizeResult.out);

    // Model name resolution
    const rawModel = props['ro.product.model'] || 'Dispositivo';
    const marketName = props['ro.product.marketname']
      || props['ro.vendor.oplus.market.name']
      || props['bluetooth.device.default_name']
      || rawModel;
    const preciseModel = (marketName !== rawModel && rawModel !== 'Dispositivo')
      ? `${marketName} (${rawModel})`
      : marketName;

    const isWifi = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\b/.test(serial);

    return {
      serial,
      model: preciseModel,
      marketName,
      androidVersion: props['ro.build.version.release'] || 'Unknown',
      resolution,
      connectionType: isWifi ? 'Wi-Fi' : 'USB',
      state: 'device',
      ram: ram.total,
      ramUsed: ram.used,
      ramUsagePercent: ram.usagePercent,
      storage: storage.capacity,
      storageUsedGB: storage.usedGB,
      storageFreeGB: storage.freeGB,
      storageUsagePercent: storage.usagePercent,
      cpuUsagePercent: cpu,
      battery: battery.level,
      isCharging: battery.charging,
      temperature: battery.temperature,
      oemUnlockAllowed: props['sys.oem_unlock_allowed'] === '1',
      bootloaderLocked: props['ro.boot.flash.locked'] !== '0',
      verifiedBootState: props['ro.boot.verifiedbootstate'] || 'unknown',
      vbmetaState: props['ro.boot.vbmeta.device_state'] || 'unknown',
    };
  }

  private parseProperties(output: string): Record<string, string> {
    const props: Record<string, string> = {};
    for (const line of output.split('\n')) {
      const match = line.match(/^\[(.*?)\]: \[(.*?)\]/);
      if (match) props[match[1]] = match[2];
    }
    return props;
  }

  private parseBattery(output: string): { level: number; charging: boolean; temperature: string } {
    let level = 0;
    let tempRaw = 0;
    let charging = false;

    for (const line of output.split('\n')) {
      if (line.includes('level:')) level = parseInt(line.split(':')[1].trim()) || 0;
      if (line.includes('temperature:')) tempRaw = parseInt(line.split(':')[1].trim()) || 0;
      if (line.includes('status:')) {
        const s = line.split(':')[1].trim();
        if (s === '2' || s === '5') charging = true;
      }
    }

    return { level, charging, temperature: (tempRaw / 10).toFixed(1) };
  }

  private parseRam(output: string): { total: string; used: string; usagePercent: number } {
    let totalKB = 0;
    let availKB = 0;

    for (const line of output.split('\n')) {
      if (line.startsWith('MemTotal:')) totalKB = parseInt(line.replace(/[^0-9]/g, '')) || 0;
      if (line.startsWith('MemAvailable:')) availKB = parseInt(line.replace(/[^0-9]/g, '')) || 0;
    }

    const totalGB = Math.round(totalKB / 1024 / 1024);
    const usedGB = totalKB > 0 ? ((totalKB - availKB) / 1024 / 1024).toFixed(1) : '0';
    const usagePercent = totalKB > 0 ? Math.round(((totalKB - availKB) / totalKB) * 100) : 0;

    return { total: `${totalGB} GB`, used: `${usedGB} GB`, usagePercent };
  }

  private parseCpu(output: string): number {
    const parts = output.replace('cpu', '').trim().split(/\s+/).map(Number);
    if (parts.length < 4) return 0;
    const idle = parts[3] || 0;
    const total = parts.reduce((a, b) => a + (b || 0), 0);
    return total > 0 ? Math.round(((total - idle) / total) * 100) : 0;
  }

  private parseStorage(output: string): { capacity: string; usedGB: number; freeGB: number; usagePercent: number } {
    const lines = output.trim().split('\n');
    if (lines.length < 2) return { capacity: 'Desconocido', usedGB: 0, freeGB: 0, usagePercent: 0 };

    const cols = lines[1].trim().split(/\s+/);
    if (cols.length < 4) return { capacity: 'Desconocido', usedGB: 0, freeGB: 0, usagePercent: 0 };

    const rawSize = parseFloat(cols[1].replace(/[^0-9.]/g, '')) || 0;
    const rawUsed = parseFloat(cols[2].replace(/[^0-9.]/g, '')) || 0;
    const rawFree = parseFloat(cols[3].replace(/[^0-9.]/g, '')) || 0;
    const unit = cols[1].replace(/[0-9.]/g, '').trim().toUpperCase();
    const mult = unit === 'T' ? 1024 : 1;

    const usedGB = Math.round(rawUsed * mult);
    const freeGB = Math.round(rawFree * mult);

    // Round to standard capacity
    const standards = [8, 16, 32, 64, 128, 256, 512, 1024];
    let capacity = standards[0];
    for (const s of standards) {
      if (rawSize * mult <= s * 0.98) { capacity = s; break; }
    }
    if (rawSize * mult > 1000) capacity = Math.ceil(rawSize * mult);

    const usagePercent = capacity > 0 ? Math.round((usedGB / capacity) * 100) : 0;
    return { capacity: `${capacity} GB`, usedGB, freeGB, usagePercent };
  }

  private parseResolution(output: string): string {
    const match = output.match(/Physical size:\s*(\d+x\d+)/);
    return match ? match[1].replace('x', ' × ') : 'Desconocida';
  }
}
