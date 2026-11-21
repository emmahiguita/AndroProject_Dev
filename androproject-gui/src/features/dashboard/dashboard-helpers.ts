// ============================================================================
// ARCHIVO: dashboard-helpers.ts
// QUÉ HACE: Funciones puras de cálculo de telemetría (CPU, RAM, Temperatura,
//           Almacenamiento) y asignación determinista de color por paquete APK.
// CÓMO FUNCIONA: Normaliza lecturas crudas de sensores Android (ej. décimas de
//           grado "350" -> 35°C) y clasifica umbrales operativos sin efectos
//           secundarios ni dependencia del estado de React.
// POR QUÉ: Cumplir Single Responsibility Principle (SOLID), facilitar el
//           mantenimiento y evitar recalcular lógica dispersa en la vista (< 200L).
// ============================================================================

import type { DeviceInfo } from '../types';

/** Filtros disponibles en el mini-gestor de aplicaciones del panel principal. */
export type AppsFilterDash = 'all' | 'user' | 'system' | 'safe' | 'bloatware';

/** Nivel semántico sobrio para indicadores de estado técnico. */
export type TelemetryLevel = 'ok' | 'warn' | 'crit' | 'neutral';

/** Estructura normalizada de telemetría lista para renderizar en UI. */
export interface DeviceTelemetrySummary {
  cpuPercent: number;
  cpuStatus: string;
  cpuLevel: TelemetryLevel;
  ramPercent: number;
  ramStatus: string;
  ramLevel: TelemetryLevel;
  tempNum: number;
  tempCelsius: string;
  tempStatus: string;
  tempLevel: TelemetryLevel;
  storagePercent: number;
  storageFreeGB: number;
  storStatus: string;
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

/**
 * Genera un color consistente para un nombre de paquete cuando aún no hay icono PNG.
 * Usa prefijos conocidos o un hash DJB2 sobre el string del packageName.
 */
export function getAppColor(pkg: string): string {
  for (const [prefix, color] of Object.entries(APP_COLORS)) {
    if (pkg.startsWith(prefix)) return color;
  }
  let hash = 0;
  for (let i = 0; i < pkg.length; i++) {
    hash = pkg.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

/**
 * Convierte la lectura térmica de Android (que puede venir en décimas como "350"
 * o en grados como "35.2") a un número flotante en grados Celsius.
 */
export function parseTempNum(rawTemp?: string): number | null {
  if (!rawTemp || rawTemp === '--') return null;
  let v = parseFloat(rawTemp);
  if (Number.isNaN(v)) return null;
  if (v > 100) v = v / 10;
  return v;
}

/**
 * Calcula todos los indicadores y estados de telemetría del dispositivo conectado.
 * Función pura O(1) sin mutaciones.
 */
export function computeDeviceTelemetry(device?: DeviceInfo | null): DeviceTelemetrySummary {
  const cpuPercent = Math.min(100, Math.max(0, device?.cpuUsagePercent ?? 0));
  const ramPercent = Math.min(100, Math.max(0, device?.ramUsagePercent ?? 0));
  const storagePercent = Math.min(100, Math.max(0, device?.storageUsagePercent ?? 0));
  const storageFreeGB = device?.storageFreeGB ?? 0;

  const tempParsed = parseTempNum(device?.temperature ?? '--');
  const tempNum = tempParsed !== null ? Math.round(tempParsed) : 0;
  const tempCelsius = tempParsed !== null ? tempParsed.toFixed(0) : '--';

  const cpuStatus = cpuPercent < 50 ? 'Normal' : cpuPercent < 80 ? 'Uso alto' : 'Crítico';
  const cpuLevel: TelemetryLevel = cpuPercent < 50 ? 'ok' : cpuPercent < 80 ? 'warn' : 'crit';

  const ramStatus = ramPercent < 60 ? 'Uso normal' : ramPercent < 85 ? 'Uso alto' : 'Crítico';
  const ramLevel: TelemetryLevel = ramPercent < 60 ? 'ok' : ramPercent < 85 ? 'warn' : 'crit';

  const tempStatus =
    tempParsed === null
      ? 'Sin lectura'
      : tempNum < 42
      ? 'Normal'
      : tempNum < 48
      ? 'Temperatura alta'
      : 'Sobrecalentamiento';
  const tempLevel: TelemetryLevel =
    tempParsed === null ? 'neutral' : tempNum < 42 ? 'ok' : tempNum < 48 ? 'warn' : 'crit';

  const storStatus = storageFreeGB > 0 ? `${storageFreeGB} GB libres` : `${100 - storagePercent}% libre`;
  const storLevel: TelemetryLevel = storagePercent < 85 ? 'neutral' : 'warn';

  return {
    cpuPercent,
    cpuStatus,
    cpuLevel,
    ramPercent,
    ramStatus,
    ramLevel,
    tempNum,
    tempCelsius,
    tempStatus,
    tempLevel,
    storagePercent,
    storageFreeGB,
    storStatus,
    storLevel,
  };
}
