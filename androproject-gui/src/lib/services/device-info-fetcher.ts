/**
 * Device Info Fetcher — High-performance cached device properties retriever.
 * SOLID: SRP (only fetches device info), DIP (depends on IAdbExecutor).
 *
 * Performance optimizations:
 * - Persistent cache for static device props (model, Android version, build, resolution)
 * - Single-process batched ADB shell execution for dynamic metrics (mem, battery, storage, cpu)
 * - Eliminates ADB USB contention with video stream
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
  fetch(serial: string): Promise<DeviceInfo | null>;
}

interface StaticProps {
  props: Record<string, string>;
  resolution: string;
  model: string;
  marketName: string;
  androidVersion: string;
}

const staticPropsCache = new Map<string, StaticProps>();
const dynamicTelemetryCache = new Map<string, { info: DeviceInfo; ts: number }>();
const TELEMETRY_CACHE_MS = 3500;

export class DeviceInfoFetcher implements IDeviceInfoFetcher {
  constructor(private adb: IAdbExecutor) {}

  async fetch(serial: string): Promise<DeviceInfo | null> {
    const now = Date.now();
    const cachedDynamic = dynamicTelemetryCache.get(serial);
    if (cachedDynamic && now - cachedDynamic.ts < TELEMETRY_CACHE_MS) {
      return cachedDynamic.info;
    }

    // 1. Fetch or reuse static props
    let staticData = staticPropsCache.get(serial);
    if (!staticData) {
      const [propsResult, sizeResult] = await Promise.all([
        this.adb.execFor(serial, 'shell getprop', 4000),
        this.adb.execFor(serial, 'shell wm size', 2000),
      ]);

      if (!propsResult.ok) return null;
      const props = this.parseProperties(propsResult.out);
      const resolution = this.parseResolution(sizeResult.out);

      const rawModel = props['ro.product.model'] || 'Dispositivo';
      const marketName =
        props['ro.product.marketname'] ||
        props['ro.vendor.oplus.market.name'] ||
        props['bluetooth.device.default_name'] ||
        rawModel;
      const preciseModel =
        marketName !== rawModel && rawModel !== 'Dispositivo'
          ? `${marketName} (${rawModel})`
          : marketName;

      staticData = {
        props,
        resolution,
        model: preciseModel,
        marketName,
        androidVersion: props['ro.build.version.release'] || 'Android',
      };
      staticPropsCache.set(serial, staticData);
    }

    // 2. Fetch dynamic telemetry in 1 SINGLE batched ADB process
    const batchCmd = `cat /proc/meminfo; echo '===SECTION==='; dumpsys battery; echo '===SECTION==='; cat /proc/stat | head -1; echo '===SECTION==='; df -h /data`;
    const batchResult = await this.adb.shell(serial, batchCmd, 3000);

    const sections = (batchResult.out || '').split('===SECTION===');
    const memOut = sections[0] || '';
    const batteryOut = sections[1] || '';
    const cpuOut = sections[2] || '';
    const dfOut = sections[3] || '';

    const battery = this.parseBattery(batteryOut);
    const ram = this.parseRam(memOut);
    const cpu = this.parseCpu(cpuOut);
    const storage = this.parseStorage(dfOut);

    const isWifi = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\b/.test(serial);
    const props = staticData.props;

    const info: DeviceInfo = {
      serial,
      model: staticData.model,
      marketName: staticData.marketName,
      androidVersion: staticData.androidVersion,
      resolution: staticData.resolution,
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

    dynamicTelemetryCache.set(serial, { info, ts: now });
    return info;
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
    let foundLevel = false;

    for (const line of output.split('\n')) {
      if (line.includes('level:')) {
        level = parseInt(line.split(':')[1].trim()) || 0;
        foundLevel = true;
      }
      if (line.includes('temperature:')) {
        tempRaw = parseInt(line.split(':')[1].trim()) || 0;
      }
      if (line.includes('status:')) {
        const s = line.split(':')[1].trim();
        if (s === '2' || s === '5') charging = true;
      }
    }

    return {
      level: foundLevel ? level : 0,
      charging,
      temperature: tempRaw > 0 ? (tempRaw / 10).toFixed(1) : '--',
    };
  }

  private parseRam(output: string): { total: string; used: string; usagePercent: number } {
    let totalKB = 0;
    let availKB = 0;

    for (const line of output.split('\n')) {
      if (line.startsWith('MemTotal:')) totalKB = parseInt(line.replace(/[^0-9]/g, '')) || 0;
      if (line.startsWith('MemAvailable:')) availKB = parseInt(line.replace(/[^0-9]/g, '')) || 0;
    }

    if (totalKB <= 0) {
      return { total: '--', used: '--', usagePercent: 0 };
    }

    const totalGB = Math.round(totalKB / 1024 / 1024);
    const usedGB = ((totalKB - availKB) / 1024 / 1024).toFixed(1);
    const usagePercent = Math.round(((totalKB - availKB) / totalKB) * 100);

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
    if (lines.length < 2) return { capacity: '--', usedGB: 0, freeGB: 0, usagePercent: 0 };

    const cols = lines[1].trim().split(/\s+/);
    if (cols.length < 4) return { capacity: '--', usedGB: 0, freeGB: 0, usagePercent: 0 };

    const rawSize = parseFloat(cols[1].replace(/[^0-9.]/g, '')) || 0;
    const rawUsed = parseFloat(cols[2].replace(/[^0-9.]/g, '')) || 0;
    const rawFree = parseFloat(cols[3].replace(/[^0-9.]/g, '')) || 0;
    const unit = cols[1].replace(/[0-9.]/g, '').trim().toUpperCase();
    const mult = unit === 'T' ? 1024 : 1;

    const usedGB = Math.round(rawUsed * mult);
    const freeGB = Math.round(rawFree * mult);

    const standards = [8, 16, 32, 64, 128, 256, 512, 1024];
    let capacity = 0;
    for (const s of standards) {
      if (rawSize * mult <= s * 0.98) {
        capacity = s;
        break;
      }
    }
    if (rawSize * mult > 1000) capacity = Math.ceil(rawSize * mult);
    if (capacity === 0 && rawSize > 0) capacity = Math.round(rawSize * mult);

    const usagePercent = capacity > 0 ? Math.round((usedGB / capacity) * 100) : 0;
    return {
      capacity: capacity > 0 ? `${capacity} GB` : '--',
      usedGB,
      freeGB,
      usagePercent,
    };
  }

  private parseResolution(output: string): string {
    const match = output.match(/Physical size:\s*(\d+x\d+)/);
    return match ? match[1].replace('x', ' × ') : '--';
  }
}
