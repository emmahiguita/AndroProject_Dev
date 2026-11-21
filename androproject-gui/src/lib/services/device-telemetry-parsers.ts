// ============================================================================
// ARCHIVO: device-telemetry-parsers.ts
// QUÉ HACE: Parsers puros y de delta temporal para métricas reales del kernel
//           Linux/Android (/proc/stat, /proc/meminfo, /proc/loadavg, df -k,
//           dumpsys battery).
// CÓMO FUNCIONA: Calcula el uso real instantáneo de CPU mediante deltas de
//           jiffies (Δactive / Δtotal) entre muestras consecutivas en lugar
//           del promedio acumulado desde el arranque, y extrae bytes exactos.
// POR QUÉ: Erradicar valores congelados (ej. CPU fija en 28%) o redondeos
//           comerciales simulados de almacenamiento (< 200 líneas, SOLID).
// ============================================================================

/** Memoria caché de jiffies previos por serial para cálculo diferencial de CPU. */
const prevCpuTicks = new Map<string, { total: number; idle: number }>();

/** Extrae { total, idle } de una línea `cpu ...` de `/proc/stat`. */
function extractCpuTicks(line: string): { total: number; idle: number } | null {
  const clean = line.replace(/^cpu\s+/, '').trim();
  if (!clean) return null;
  const parts = clean.split(/\s+/).map(Number);
  if (parts.length < 4 || parts.some((n) => Number.isNaN(n))) return null;
  // idle real = idle (col 3) + iowait (col 4)
  const idle = (parts[3] || 0) + (parts[4] || 0);
  const total = parts.reduce((acc, v) => acc + (v || 0), 0);
  return total > 0 ? { total, idle } : null;
}

/**
 * Calcula el porcentaje real instantáneo de uso de CPU (0-100%) usando el delta
 * contra la lectura anterior del mismo serial (o entre inicio y fin del batch).
 */
export function parseCpuDelta(serial: string, cpuStartRaw: string, cpuEndRaw?: string): number {
  const start = extractCpuTicks(cpuStartRaw);
  const end = cpuEndRaw ? extractCpuTicks(cpuEndRaw) : null;
  const current = end || start;
  if (!current) return 0;

  const prev = prevCpuTicks.get(serial) || (end && start ? start : null);
  prevCpuTicks.set(serial, current);

  if (prev && current.total > prev.total) {
    const deltaTotal = current.total - prev.total;
    const deltaIdle = current.idle - prev.idle;
    const active = Math.max(0, deltaTotal - deltaIdle);
    return Math.min(100, Math.max(0, Math.round((active / deltaTotal) * 100)));
  }

  // Fallback primera muestra si start === end
  return Math.min(100, Math.max(0, Math.round(((current.total - current.idle) / current.total) * 100)));
}

/**
 * Parsea `/proc/meminfo` devolviendo RAM total, usada, libre en MB y porcentaje real.
 */
export function parseRamInfo(output: string): {
  total: string;
  used: string;
  freeMB: number;
  usagePercent: number;
} {
  let totalKB = 0;
  let availKB = 0;
  for (const line of output.split('\n')) {
    if (line.startsWith('MemTotal:')) totalKB = parseInt(line.replace(/[^0-9]/g, ''), 10) || 0;
    else if (line.startsWith('MemAvailable:')) availKB = parseInt(line.replace(/[^0-9]/g, ''), 10) || 0;
  }
  if (totalKB <= 0) return { total: '--', used: '--', freeMB: 0, usagePercent: 0 };

  const usedKB = Math.max(0, totalKB - availKB);
  const totalGB = (totalKB / 1048576).toFixed(1);
  const usedGB = (usedKB / 1048576).toFixed(1);
  const freeMB = Math.round(availKB / 1024);
  const usagePercent = Math.round((usedKB / totalKB) * 100);

  return { total: `${totalGB} GB`, used: `${usedGB} GB`, freeMB, usagePercent };
}

/**
 * Parsea `df -k /data` (bloques de 1 KiB) para obtener gigabytes exactos del
 * sistema de archivos real sin redondear a tamaños comerciales ficticios.
 */
export function parseStorageInfo(output: string): {
  capacity: string;
  usedGB: number;
  freeGB: number;
  usagePercent: number;
} {
  const lines = output.trim().split('\n');
  if (lines.length < 2) return { capacity: '--', usedGB: 0, freeGB: 0, usagePercent: 0 };

  const cols = lines[lines.length - 1].trim().split(/\s+/);
  if (cols.length < 4) return { capacity: '--', usedGB: 0, freeGB: 0, usagePercent: 0 };

  const sizeKB = parseFloat(cols[1]) || 0;
  const usedKB = parseFloat(cols[2]) || 0;
  const freeKB = parseFloat(cols[3]) || 0;
  if (sizeKB <= 0) return { capacity: '--', usedGB: 0, freeGB: 0, usagePercent: 0 };

  const totalGB = Number((sizeKB / 1048576).toFixed(1));
  const usedGB = Number((usedKB / 1048576).toFixed(1));
  const freeGB = Number((freeKB / 1048576).toFixed(1));
  const usagePercent = Math.min(100, Math.round((usedKB / sizeKB) * 100));

  return {
    capacity: `${totalGB} GB`,
    usedGB,
    freeGB,
    usagePercent,
  };
}

/**
 * Parsea `dumpsys battery` extrayendo nivel, carga, temperatura real (°C),
 * voltaje en mV y tecnología de celda.
 */
export function parseBatteryInfo(output: string): {
  level: number;
  charging: boolean;
  temperature: string;
  voltageMv: number;
  technology: string;
} {
  let level = 0;
  let tempRaw = 0;
  let charging = false;
  let voltageMv = 0;
  let technology = 'Li-ion';

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('level:')) level = parseInt(trimmed.split(':')[1]?.trim() || '0', 10) || 0;
    else if (trimmed.startsWith('temperature:')) tempRaw = parseInt(trimmed.split(':')[1]?.trim() || '0', 10) || 0;
    else if (trimmed.startsWith('status:')) {
      const s = trimmed.split(':')[1]?.trim();
      if (s === '2' || s === '5') charging = true;
    } else if (trimmed.startsWith('Charger voltage') || trimmed.startsWith('voltage:')) {
      const v = parseInt(trimmed.split(':')[1]?.trim() || '0', 10) || 0;
      if (v > 1000) voltageMv = v;
    } else if (trimmed.startsWith('technology:')) {
      technology = trimmed.split(':')[1]?.trim() || 'Li-ion';
    }
  }

  return {
    level,
    charging,
    temperature: tempRaw > 0 ? (tempRaw / 10).toFixed(1) : '--',
    voltageMv,
    technology,
  };
}

/** Parsea `/proc/loadavg` y `/proc/uptime` para hilos activos y horas encendido. */
export function parseLoadAndUptime(loadOut: string, uptimeOut: string): {
  cpuLoadAvg: string;
  activeThreads: string;
  uptimeHours: string;
} {
  const loadParts = loadOut.trim().split(/\s+/);
  const cpuLoadAvg = loadParts[0] || '--';
  const activeThreads = loadParts[3] || '--';
  const upSec = parseFloat(uptimeOut.trim().split(/\s+/)[0] || '0') || 0;
  const uptimeHours = upSec > 0 ? `${(upSec / 3600).toFixed(1)} h` : '--';
  return { cpuLoadAvg, activeThreads, uptimeHours };
}
