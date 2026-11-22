// ============================================================================
// ARCHIVO: logcatCrashBuilder.ts
// QUÉ HACE: Provee tipos (`LogLevel`, `StructuredCrash`), detección/armado
//           de reportes forenses de crashes Android y descarga de archivos.
// CÓMO FUNCIONA: Clasifica líneas de crash (`ANR`, `NATIVE_CRASH`, `OOM`,
//           `FATAL_EXCEPTION`), extrae paquete afectado y genera el dump
//           completo con contexto previo, además de unificar descargas Blob.
// POR QUÉ: Separar la lógica pura de armado/exportación mantiene
//           `useLogcatStream.ts` por debajo de 200 líneas (SRP / DRY).
// ============================================================================

import type { LogcatEntry } from '@/app/api/logcat/route';

export type LogLevel = 'ALL' | 'V' | 'D' | 'I' | 'W' | 'E' | 'F';

export interface StructuredCrash {
  id: string;
  timestamp: string;
  packageName: string;
  activityName?: string;
  pid: string;
  tid: string;
  crashType: 'FATAL_EXCEPTION' | 'NATIVE_CRASH' | 'ANR' | 'OUT_OF_MEMORY' | 'SYSTEM_ERROR';
  title: string;
  reason: string;
  stackTrace: string[];
  contextLogs: LogcatEntry[];
  rawDump: string;
}

export const LEVEL_WEIGHT: Record<string, number> = {
  ALL: 0, V: 1, D: 2, I: 3, W: 4, E: 5, F: 6, S: 7,
};

export function isCrashTriggerLine(entry: LogcatEntry): boolean {
  return Boolean(
    entry.isCrash ||
    entry.tag === 'AndroidRuntime' ||
    entry.tag === 'DEBUG' ||
    entry.message.includes('FATAL EXCEPTION') ||
    entry.message.includes('ANR in ') ||
    entry.message.includes('SIGSEGV') ||
    entry.message.includes('SIGABRT'),
  );
}

export function isStackContinuationLine(msg: string): boolean {
  return (
    msg.startsWith('at ') ||
    msg.startsWith('\tat ') ||
    msg.startsWith('Caused by: ') ||
    msg.startsWith('Suppressed: ') ||
    msg.startsWith('#00 pc ') ||
    msg.startsWith('backtrace:')
  );
}

export function detectCrashType(entry: LogcatEntry): StructuredCrash['crashType'] {
  if (entry.message.includes('ANR in ')) return 'ANR';
  if (entry.tag === 'DEBUG' || entry.message.includes('SIGSEGV') || entry.message.includes('SIGABRT')) {
    return 'NATIVE_CRASH';
  }
  if (entry.message.includes('OutOfMemoryError')) return 'OUT_OF_MEMORY';
  return 'FATAL_EXCEPTION';
}

export function extractCrashPackage(entry: LogcatEntry, fallbackPkg?: string): string {
  const pkgMatch =
    entry.message.match(/Process:\s*([a-zA-Z0-9._]+)/) ||
    entry.message.match(/ANR in\s*([a-zA-Z0-9._]+)/);
  return pkgMatch ? pkgMatch[1] : (fallbackPkg || 'Sistema / Desconocido');
}

export function buildRawCrashDump(crash: StructuredCrash, serial?: string): string {
  return [
    '=== INFORME FORENSE DE FALLO COMPLETO — ANDROPROJECT INSPECTOR ===',
    `Fecha y Hora: ${crash.timestamp}`,
    `Dispositivo: ${serial || 'Android'}`,
    `Aplicación: ${crash.packageName}`,
    `Tipo de Fallo: ${crash.crashType}`,
    `PID: ${crash.pid} | TID: ${crash.tid}`,
    `Causa / Resumen: ${crash.title}`,
    '',
    '=== STACKTRACE COMPLETO ===',
    ...(crash.stackTrace.length > 0 ? crash.stackTrace : [crash.reason]),
    '',
    '=== CONTEXTO DEL SISTEMA PREVIO AL FALLO (Últimos eventos) ===',
    ...crash.contextLogs.map((l) => `[${l.timestamp}] ${l.level}/${l.tag}(${l.pid}): ${l.message}`),
  ].join('\n');
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
