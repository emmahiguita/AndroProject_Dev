// ============================================================================
// ARCHIVO: device-info-fetcher.ts
// QUÉ HACE: Recupera las propiedades estáticas y la telemetría dinámica real
//           del dispositivo Android conectado en un único lote ADB por ciclo.
// CÓMO FUNCIONA: Cachea metadatos invariables (modelo, resolución, build) y
//           ejecuta un comando combinado para `/proc/stat`, `/proc/meminfo`,
//           `dumpsys battery`, `df -k /data`, `/proc/loadavg` y `/proc/uptime`.
// POR QUÉ: Evitar contención USB con el stream H.264 de 60 FPS y entregar
//           métricas 100% reales sin simulaciones (< 200 líneas, SOLID).
// ============================================================================

import { IAdbExecutor } from './adb-executor';
import {
  parseCpuDelta,
  parseRamInfo,
  parseStorageInfo,
  parseBatteryInfo,
  parseLoadAndUptime,
} from './device-telemetry-parsers';

export interface DeviceInfo {
  serial: string;
  model: string;
  marketName: string;
  androidVersion: string;
  resolution: string;
  connectionType: 'USB' | 'Wi-Fi';
  state: string;
  ram: string;
  ramUsed: string;
  ramFreeMB: number;
  ramUsagePercent: number;
  storage: string;
  storageUsedGB: number;
  storageFreeGB: number;
  storageUsagePercent: number;
  cpuUsagePercent: number;
  cpuLoadAvg: string;
  activeThreads: string;
  uptimeHours: string;
  battery: number;
  isCharging: boolean;
  temperature: string;
  batteryVoltageMv: number;
  batteryTech: string;
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
const TELEMETRY_CACHE_MS = 2000;

export class DeviceInfoFetcher implements IDeviceInfoFetcher {
  constructor(private adb: IAdbExecutor) {}

  async fetch(serial: string): Promise<DeviceInfo | null> {
    const now = Date.now();
    const cachedDynamic = dynamicTelemetryCache.get(serial);
    if (cachedDynamic && now - cachedDynamic.ts < TELEMETRY_CACHE_MS) {
      return cachedDynamic.info;
    }

    // 1. Obtener o reutilizar propiedades estáticas de hardware
    let staticData = staticPropsCache.get(serial);
    if (!staticData) {
      const [propsResult, sizeResult] = await Promise.all([
        this.adb.execFor(serial, ['shell', 'getprop'], 4000),
        this.adb.execFor(serial, ['shell', 'wm', 'size'], 2000),
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

    // 2. Telemetría dinámica real en 1 sola ejecución ADB (incluye muestra inicial y final de /proc/stat)
    const batchCmd = [
      'head -n 1 /proc/stat',
      'cat /proc/meminfo',
      'dumpsys battery',
      'df -k /data',
      'cat /proc/loadavg',
      'cat /proc/uptime',
      'head -n 1 /proc/stat',
    ].join("; echo '===SEC==='; ");

    const batchResult = await this.adb.execFor(serial, ['shell', batchCmd], 3000);
    const sections = (batchResult.out || '').split('===SEC===');

    const cpuStartOut = sections[0] || '';
    const memOut = sections[1] || '';
    const batteryOut = sections[2] || '';
    const dfOut = sections[3] || '';
    const loadOut = sections[4] || '';
    const uptimeOut = sections[5] || '';
    const cpuEndOut = sections[6] || '';

    const cpu = parseCpuDelta(serial, cpuStartOut, cpuEndOut);
    const ram = parseRamInfo(memOut);
    const battery = parseBatteryInfo(batteryOut);
    const storage = parseStorageInfo(dfOut);
    const sysLoad = parseLoadAndUptime(loadOut, uptimeOut);

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
      ramFreeMB: ram.freeMB,
      ramUsagePercent: ram.usagePercent,
      storage: storage.capacity,
      storageUsedGB: storage.usedGB,
      storageFreeGB: storage.freeGB,
      storageUsagePercent: storage.usagePercent,
      cpuUsagePercent: cpu,
      cpuLoadAvg: sysLoad.cpuLoadAvg,
      activeThreads: sysLoad.activeThreads,
      uptimeHours: sysLoad.uptimeHours,
      battery: battery.level,
      isCharging: battery.charging,
      temperature: battery.temperature,
      batteryVoltageMv: battery.voltageMv,
      batteryTech: battery.technology,
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

  private parseResolution(output: string): string {
    const match = output.match(/Physical size:\s*(\d+x\d+)/);
    return match ? match[1].replace('x', ' × ') : '--';
  }
}
