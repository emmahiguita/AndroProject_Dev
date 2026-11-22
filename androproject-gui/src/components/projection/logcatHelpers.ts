// ============================================================================
// ARCHIVO: logcatHelpers.ts
// QUÉ HACE: Provee colores por nivel Logcat, deduplicación de logs/crashes,
//           filtrado por app en primer plano y armado de diagnóstico forense.
// CÓMO FUNCIONA: Agrupa entradas consecutivas idénticas con `repeatCount`,
//           consolida crashes repetidos por paquete/PID/tipo y unifica el
//           filtrado de logs por paquete para evitar lógica duplicada.
// POR QUÉ: Desacoplar utilidades puras mantiene `LogcatInspectorPanel.tsx`
//           y sus vistas por debajo de 200 líneas (SRP / DRY).
// ============================================================================

import type { LogcatEntry } from '@/app/api/logcat/route';
import type { StructuredCrash } from '@/hooks/useLogcatStream';

export type DeduplicatedLogEntry = LogcatEntry & { repeatCount: number };
export type DeduplicatedCrash = StructuredCrash & { occurrences: number };

export const LEVEL_COLORS: Record<string, { badge: string; text: string; bg: string }> = {
  V: { badge: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20', text: 'text-zinc-500', bg: 'hover:bg-zinc-500/5' },
  D: { badge: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25', text: 'text-zinc-400', bg: 'hover:bg-zinc-500/5' },
  I: { badge: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/25', text: 'text-zinc-200', bg: 'hover:bg-zinc-500/5' },
  W: { badge: 'bg-zinc-500/20 text-zinc-200 border-zinc-500/35', text: 'text-zinc-100 font-medium', bg: 'hover:bg-zinc-500/10' },
  E: { badge: 'bg-red-500/15 text-red-500 border-red-500/30', text: 'text-red-500 font-medium', bg: 'bg-red-500/5 hover:bg-red-500/10' },
  F: { badge: 'bg-red-600/20 text-red-500 border-red-500/40', text: 'text-red-500 font-bold', bg: 'bg-red-500/10 hover:bg-red-500/15' },
  S: { badge: 'bg-zinc-700/25 text-zinc-400 border-zinc-600/30', text: 'text-zinc-400', bg: 'hover:bg-zinc-800/30' },
};

/** Agrupa logs consecutivos idénticos incrementando `repeatCount`. */
export function deduplicateLogs(logs: LogcatEntry[]): DeduplicatedLogEntry[] {
  const result: DeduplicatedLogEntry[] = [];
  for (const log of logs) {
    const last = result[result.length - 1];
    if (last && last.level === log.level && last.tag === log.tag && last.pid === log.pid && last.message === log.message) {
      last.repeatCount += 1;
      last.timestamp = log.timestamp;
    } else {
      result.push({ ...log, repeatCount: 1 });
    }
  }
  return result;
}

/** Agrupa crashes repetidos en bóveda por paquete, PID y tipo de fallo. */
export function deduplicateVault(crashVault: StructuredCrash[]): DeduplicatedCrash[] {
  const map = new Map<string, DeduplicatedCrash>();
  for (const c of crashVault) {
    const key = `${c.packageName}_${c.pid}_${c.crashType}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...c, occurrences: 1 });
    } else {
      existing.occurrences += 1;
      if (c.stackTrace.length > existing.stackTrace.length) {
        existing.stackTrace = c.stackTrace;
        existing.rawDump = c.rawDump;
        existing.title = c.title;
      }
    }
  }
  return Array.from(map.values());
}

/** Filtra logs relacionados con un paquete específico (helper compartido DRY). */
export function filterLogsByPackage(logs: DeduplicatedLogEntry[], packageName: string): DeduplicatedLogEntry[] {
  const pkg = packageName.toLowerCase();
  return logs.filter(
    (l) =>
      l.message.toLowerCase().includes(pkg) ||
      l.tag.toLowerCase().includes(pkg) ||
      l.packageName?.toLowerCase() === pkg,
  );
}

/** Construye el reporte forense completo para la app activa en primer plano. */
export function buildActiveAppDiagnosis(
  serial: string | undefined,
  activeApp: { packageName: string; activityName?: string },
  deduplicatedLogs: DeduplicatedLogEntry[],
  crashVault: StructuredCrash[],
): string {
  const pkg = activeApp.packageName;
  const appLogs = filterLogsByPackage(deduplicatedLogs, pkg);
  const errors = appLogs.filter((l) => l.level === 'E' || l.level === 'F');
  const crashes = crashVault.filter((c) => c.packageName.toLowerCase().includes(pkg.toLowerCase()));

  return [
    '======================================================================',
    'DIAGNÓSTICO FORENSE DE APLICACIÓN - ANDROPROJECT',
    '======================================================================',
    `Dispositivo : ${serial || 'Desconocido'}`,
    `Fecha       : ${new Date().toLocaleString()}`,
    `Paquete     : ${pkg}`,
    `Activity    : ${activeApp.activityName || 'Desconocida'}`,
    `Estado      : ${errors.length === 0 && crashes.length === 0 ? 'ESTABLE' : 'ERRORES DETECTADOS'}`,
    '----------------------------------------------------------------------',
    '[RESUMEN OPERATIVO]',
    `- Total eventos registrados : ${appLogs.length}`,
    `- Errores / Excepciones      : ${errors.length}`,
    `- Fallos críticos (Crashes)  : ${crashes.length}`,
    '',
    crashes.length > 0
      ? ['[CRASHES Y STACKTRACES CRÍTICOS]', ...crashes.map((c) =>
          `-- Fallo: ${c.crashType} (PID: ${c.pid}) a las ${c.timestamp}\nTitulo: ${c.title}\nStackTrace:\n${c.stackTrace.join('\n')}\n`,
        )].join('\n')
      : '[CRASHES]: Ningún fallo fatal registrado para esta aplicación.',
    '',
    '[ÚLTIMOS LOGS DE LA APLICACIÓN]',
    ...appLogs.slice(-40).map((l) => `[${l.timestamp}] [${l.level}/${l.tag}] (PID:${l.pid}) ${l.message}`),
    '======================================================================',
  ].join('\n');
}
