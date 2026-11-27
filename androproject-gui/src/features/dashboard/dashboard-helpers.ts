// ============================================================================
// ARCHIVO: dashboard-helpers.ts
// QUÉ HACE: Funciones puras de cálculo de telemetría real (CPU delta, RAM en
//           GB/MB, Temperatura con décimas, Almacenamiento real y carga de
//           hilos) y asignación determinista de color por paquete APK.
// CÓMO FUNCIONA: Toma los datos reales leídos de `/proc/stat`, `/proc/meminfo`,
//           `df -k /data` y `dumpsys battery` y construye etiquetas técnicas
//           exactas sin valores simulados.
// POR QUÉ: Cumplir Single Responsibility Principle (SOLID) y separar la lógica
//           de formato técnico de los componentes visuales (< 200 líneas).
// ============================================================================

import type { DeviceInfo } from '../types';

/** Filtros disponibles en el mini-gestor de aplicaciones del panel principal. */
export type AppsFilterDash = 'all' | 'user' | 'system' | 'safe' | 'bloatware';

/** Nivel semántico sobrio para indicadores de estado técnico. */
export type TelemetryLevel = 'ok' | 'warn' | 'crit' | 'neutral';

/** Estructura normalizada de telemetría real lista para renderizar en UI. */
export interface DeviceTelemetrySummary {
  cpuPercent: number;
  cpuStatus: string;
  cpuSubDetail: string;
  cpuLevel: TelemetryLevel;
  ramPercent: number;
  ramStatus: string;
  ramSubDetail: string;
  ramLevel: TelemetryLevel;
  tempNum: number;
  tempCelsius: string;
  tempStatus: string;
  tempSubDetail: string;
  tempLevel: TelemetryLevel;
  storagePercent: number;
  storageFreeGB: number;
  storStatus: string;
  storSubDetail: string;
  storLevel: TelemetryLevel;
}

/** Mapa de colores base para paquetes Android conocidos (fallback de icono). */
const APP_COLORS: Record<string, string> = {
  'com.android.chrome': '#4285F4',
  'com.google.android': '#3DDC84',
  'com.spotify': '#1DB954',
  'com.whatsapp': '#25D366',
  'com.instagram': '#E4405F',
  'com.facebook': '#1877F2',
  'com.twitter': '#1DA1F2',
  'com.youtube': '#FF0000',
  'com.netflix': '#E50914',
  'com.telegram': '#0088CC',
  'com.oplus': '#1BAE6E',
  'com.coloros': '#1BAE6E',
};

/** Genera un color consistente para un paquete cuando aún no hay icono PNG. */
export function getAppColor(pkg: string): string {
  for (const [prefix, color] of Object.entries(APP_COLORS)) {
    if (pkg.startsWith(prefix)) return color;
  }
  let hash = 0;
  for (let i = 0; i < pkg.length; i++) {
    hash = pkg.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 55%, 45%)`;
}

/** Normaliza lectura térmica de Android ("353" -> 35.3°C o "35.3" -> 35.3°C). */
export function parseTempNum(rawTemp?: string): number | null {
  if (!rawTemp || rawTemp === '--') return null;
  let v = parseFloat(rawTemp);
  if (Number.isNaN(v)) return null;
  if (v > 100) v = v / 10;
  return v;
}

/**
 * Construye el resumen completo de telemetría real a partir del objeto `DeviceInfo`
 * entregado por `/api/device` (lectura directa del kernel Android).
 */
export function computeDeviceTelemetry(device?: DeviceInfo | null): DeviceTelemetrySummary {
  const cpuPercent = Math.min(100, Math.max(0, device?.cpuUsagePercent ?? 0));
  const ramPercent = Math.min(100, Math.max(0, device?.ramUsagePercent ?? 0));
  const storagePercent = Math.min(100, Math.max(0, device?.storageUsagePercent ?? 0));
  const storageFreeGB = device?.storageFreeGB ?? 0;

  const tempParsed = parseTempNum(device?.temperature ?? '--');
  const tempNum = tempParsed !== null ? Math.round(tempParsed) : 0;
  const tempCelsius = tempParsed !== null ? tempParsed.toFixed(1) : '--';

  const cpuStatus = device?.cpuUsagePercent == null ? 'Sin lectura' : cpuPercent < 50 ? 'Normal' : cpuPercent < 80 ? 'Carga media' : 'Crítico';
  const cpuLevel: TelemetryLevel = device?.cpuUsagePercent == null ? 'neutral' : cpuPercent < 50 ? 'ok' : cpuPercent < 80 ? 'warn' : 'crit';
  const cpuSubDetail = device?.activeThreads
    ? `Load ${device.cpuLoadAvg || '--'} · Hilos ${device.activeThreads}`
    : 'Delta /proc/stat en vivo';

  const ramStatus = device?.ramUsagePercent == null ? 'Sin lectura' : ramPercent < 65 ? 'Normal' : ramPercent < 85 ? 'Uso alto' : 'Crítico';
  const ramLevel: TelemetryLevel = device?.ramUsagePercent == null ? 'neutral' : ramPercent < 65 ? 'ok' : ramPercent < 85 ? 'warn' : 'crit';
  const ramSubDetail =
    device?.ramUsed && device?.ram
      ? `${device.ramUsed} / ${device.ram} (${device.ramFreeMB ?? '--'} MB libres)`
      : 'Lectura /proc/meminfo';

  const tempStatus =
    tempParsed === null
      ? 'Sin sensor'
      : tempNum < 41
      ? 'Normal'
      : tempNum < 46
      ? 'Templado'
      : 'Caliente';
  const tempLevel: TelemetryLevel =
    tempParsed === null ? 'neutral' : tempNum < 41 ? 'ok' : tempNum < 46 ? 'warn' : 'crit';
  const tempSubDetail = device?.batteryVoltageMv
    ? `${device.batteryVoltageMv} mV · ${device.batteryTech || 'Sin lectura'}`
    : `Batería ${device?.battery ?? '--'}%`;

  const storStatus = device?.storageUsagePercent == null ? 'Sin lectura' : storageFreeGB > 0 ? `${storageFreeGB} GB libres` : `${100 - storagePercent}% libre`;
  const storLevel: TelemetryLevel = device?.storageUsagePercent == null ? 'neutral' : storagePercent < 85 ? 'neutral' : 'warn';
  const storSubDetail =
    device?.storageUsedGB != null && device?.storage
      ? `${device.storageUsedGB} GB usados de ${device.storage}`
      : 'Partición /data';

  return {
    cpuPercent,
    cpuStatus,
    cpuSubDetail,
    cpuLevel,
    ramPercent,
    ramStatus,
    ramSubDetail,
    ramLevel,
    tempNum,
    tempCelsius,
    tempStatus,
    tempSubDetail,
    tempLevel,
    storagePercent,
    storageFreeGB,
    storStatus,
    storSubDetail,
    storLevel,
  };
}
