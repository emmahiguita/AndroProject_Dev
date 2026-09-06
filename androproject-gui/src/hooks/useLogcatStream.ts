'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

const LEVEL_WEIGHT: Record<string, number> = {
  ALL: 0,
  V: 1,
  D: 2,
  I: 3,
  W: 4,
  E: 5,
  F: 6,
  S: 7,
};

const MAX_LOGS_BUFFER = 800;

interface UseLogcatStreamOptions {
  serial?: string;
  enabled?: boolean;
  onAppSwitch?: (pkg: string, activity?: string) => void;
  onCrash?: (crash: StructuredCrash) => void;
}

export function useLogcatStream({
  serial,
  enabled = true,
  onAppSwitch,
  onCrash,
}: UseLogcatStreamOptions) {
  const [logs, setLogs] = useState<LogcatEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [filterLevel, setFilterLevel] = useState<LogLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByCurrentApp, setFilterByCurrentApp] = useState(false);
  const [activeApp, setActiveApp] = useState<{ packageName: string; activityName?: string } | null>(null);
  
  // Full Structured Crash Reports
  const [latestCrash, setLatestCrash] = useState<StructuredCrash | null>(null);
  const [crashVault, setCrashVault] = useState<StructuredCrash[]>([]);

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const logsRef = useRef<LogcatEntry[]>([]);
  logsRef.current = logs;

  const activeAppRef = useRef(activeApp);
  activeAppRef.current = activeApp;

  const onAppSwitchRef = useRef(onAppSwitch);
  onAppSwitchRef.current = onAppSwitch;

  const onCrashRef = useRef(onCrash);
  onCrashRef.current = onCrash;

  const incomingQueueRef = useRef<LogcatEntry[]>([]);
  const currentCrashBuildingRef = useRef<StructuredCrash | null>(null);
  const crashFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Micro-batch flush interval (100ms) to prevent React render saturation
  useEffect(() => {
    const flushInterval = setInterval(() => {
      if (incomingQueueRef.current.length === 0) return;
      const batch = incomingQueueRef.current.splice(0, incomingQueueRef.current.length);
      setLogs((prev) => {
        const combined = [...prev, ...batch];
        if (combined.length > MAX_LOGS_BUFFER) {
          return combined.slice(combined.length - MAX_LOGS_BUFFER);
        }
        return combined;
      });
    }, 100);

    return () => clearInterval(flushInterval);
  }, []);

  // Finalize an aggregated crash report
  const finalizeCrash = useCallback(() => {
    if (!currentCrashBuildingRef.current) return;
    const finishedCrash = {
      ...currentCrashBuildingRef.current,
      rawDump: [
        `=== INFORME FORENSE DE FALLO COMPLETO — ANDROPROJECT INSPECTOR ===`,
        `Fecha y Hora: ${currentCrashBuildingRef.current.timestamp}`,
        `Dispositivo: ${serial || 'Android'}`,
        `Aplicación: ${currentCrashBuildingRef.current.packageName}`,
        `Tipo de Fallo: ${currentCrashBuildingRef.current.crashType}`,
        `PID: ${currentCrashBuildingRef.current.pid} | TID: ${currentCrashBuildingRef.current.tid}`,
        `Causa / Resumen: ${currentCrashBuildingRef.current.title}`,
        ``,
        `=== STACKTRACE COMPLETO ===`,
        ...(currentCrashBuildingRef.current.stackTrace.length > 0
          ? currentCrashBuildingRef.current.stackTrace
          : [currentCrashBuildingRef.current.reason]),
        ``,
        `=== CONTEXTO DEL SISTEMA PREVIO AL FALLO (Últimos eventos) ===`,
        ...currentCrashBuildingRef.current.contextLogs.map(
          (l) => `[${l.timestamp}] ${l.level}/${l.tag}(${l.pid}): ${l.message}`
        ),
      ].join('\n'),
    };

    setLatestCrash(finishedCrash);
    setCrashVault((prev) => {
      // If the top crash in the vault has the same package and pid, replace it with the more complete one
      if (prev.length > 0 && prev[0].packageName === finishedCrash.packageName && prev[0].pid === finishedCrash.pid) {
        return [finishedCrash, ...prev.slice(1)];
      }
      return [finishedCrash, ...prev.slice(0, 49)];
    });
    onCrashRef.current?.(finishedCrash);
    currentCrashBuildingRef.current = null;
  }, [serial]);

  // Connect to SSE stream
  useEffect(() => {
    if (!enabled || !serial) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const url = `/api/logcat?serial=${encodeURIComponent(serial)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      if (isPausedRef.current) return;

      try {
        const entry: LogcatEntry = JSON.parse(event.data);

        // 1. Detect app switch / foreground change
        if (entry.isAppSwitch && entry.packageName) {
          const appInfo = { packageName: entry.packageName, activityName: entry.activityName };
          setActiveApp(appInfo);
          onAppSwitchRef.current?.(entry.packageName, entry.activityName);
        }

        // 2. Detect and aggregate Complete Crashes & Stacktraces
        const isCrashTrigger =
          entry.isCrash ||
          entry.tag === 'AndroidRuntime' ||
          entry.tag === 'DEBUG' ||
          entry.message.includes('FATAL EXCEPTION') ||
          entry.message.includes('ANR in ') ||
          entry.message.includes('SIGSEGV') ||
          entry.message.includes('SIGABRT');

        const isStackLine =
          entry.message.startsWith('at ') ||
          entry.message.startsWith('\tat ') ||
          entry.message.startsWith('Caused by: ') ||
          entry.message.startsWith('Suppressed: ') ||
          entry.message.startsWith('#00 pc ') ||
          entry.message.startsWith('backtrace:');

        if (isCrashTrigger && !isStackLine) {
          // If we are already building a crash for the same PID, do not finalize and recreate
          const isSameCrash =
            currentCrashBuildingRef.current &&
            (currentCrashBuildingRef.current.pid === entry.pid ||
              (entry.pid === '0' && currentCrashBuildingRef.current.packageName.includes(entry.tag)));

          if (isSameCrash && currentCrashBuildingRef.current) {
            // Append more specific title/reason if available
            if (entry.message.includes('Exception') || entry.message.includes('Error')) {
              currentCrashBuildingRef.current.reason = entry.message;
            }
            currentCrashBuildingRef.current.stackTrace.push(entry.raw);
            if (crashFinalizeTimerRef.current) clearTimeout(crashFinalizeTimerRef.current);
            crashFinalizeTimerRef.current = setTimeout(finalizeCrash, 1200);
          } else {
            if (currentCrashBuildingRef.current) {
              finalizeCrash();
            }

            let crashType: StructuredCrash['crashType'] = 'FATAL_EXCEPTION';
            if (entry.message.includes('ANR in ')) crashType = 'ANR';
            else if (entry.tag === 'DEBUG' || entry.message.includes('SIGSEGV') || entry.message.includes('SIGABRT')) crashType = 'NATIVE_CRASH';
            else if (entry.message.includes('OutOfMemoryError')) crashType = 'OUT_OF_MEMORY';

            let pkg = activeAppRef.current?.packageName || 'Sistema / Desconocido';
            const pkgMatch = entry.message.match(/Process:\s*([a-zA-Z0-9._]+)/) || entry.message.match(/ANR in\s*([a-zA-Z0-9._]+)/);
            if (pkgMatch) {
              pkg = pkgMatch[1];
            }

            const contextLogs = logsRef.current.slice(-20);

            currentCrashBuildingRef.current = {
              id: `crash-${Date.now()}-${entry.pid}`,
              timestamp: entry.timestamp,
              packageName: pkg,
              activityName: activeAppRef.current?.activityName,
              pid: entry.pid,
              tid: entry.tid,
              crashType,
              title: entry.message,
              reason: entry.message,
              stackTrace: [entry.raw],
              contextLogs,
              rawDump: '',
            };

            if (crashFinalizeTimerRef.current) clearTimeout(crashFinalizeTimerRef.current);
            crashFinalizeTimerRef.current = setTimeout(finalizeCrash, 1200);
          }
        } else if (isStackLine && currentCrashBuildingRef.current) {
          currentCrashBuildingRef.current.stackTrace.push(entry.raw);
          if (crashFinalizeTimerRef.current) clearTimeout(crashFinalizeTimerRef.current);
          crashFinalizeTimerRef.current = setTimeout(finalizeCrash, 1200);
        }

        // Push to micro-batch queue instead of synchronous state update
        incomingQueueRef.current.push(entry);
      } catch (err) {
        // Ignore non-json chunks
      }
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      incomingQueueRef.current = [];
      if (crashFinalizeTimerRef.current) clearTimeout(crashFinalizeTimerRef.current);
    };
  }, [serial, enabled, finalizeCrash]);

  // Clear logs buffer
  const clearLogs = useCallback(() => {
    setLogs([]);
    setLatestCrash(null);
  }, []);

  // Clear crash vault
  const clearCrashVault = useCallback(() => {
    setCrashVault([]);
    setLatestCrash(null);
  }, []);

  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  // Dismiss latest crash banner
  const dismissCrash = useCallback(() => {
    setLatestCrash(null);
  }, []);

  // Export full raw log file
  const exportLogs = useCallback(() => {
    if (logs.length === 0) return;
    const text = logs.map((l) => `${l.timestamp} ${l.pid} ${l.tid} ${l.level} ${l.tag}: ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `androproject-logcat-${serial || 'device'}-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs, serial]);

  // Export a specific crash report
  const exportCrashReport = useCallback((crash: StructuredCrash) => {
    const blob = new Blob([crash.rawDump], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CRASH_REPORT-${crash.packageName.replace(/[^a-zA-Z0-9._-]/g, '_')}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Filtered logs memoized
  const filteredLogs = useMemo(() => {
    const minWeight = LEVEL_WEIGHT[filterLevel] || 0;
    const query = searchQuery.trim().toLowerCase();
    const currentPkg = activeApp?.packageName?.toLowerCase();

    return logs.filter((log) => {
      if (filterLevel !== 'ALL') {
        const logWeight = LEVEL_WEIGHT[log.level] || 1;
        if (logWeight < minWeight) return false;
      }

      if (filterByCurrentApp && currentPkg) {
        const matchesPkg =
          log.packageName?.toLowerCase().includes(currentPkg) ||
          log.tag.toLowerCase().includes(currentPkg) ||
          log.message.toLowerCase().includes(currentPkg);
        if (!matchesPkg) return false;
      }

      if (query) {
        const match =
          log.tag.toLowerCase().includes(query) ||
          log.message.toLowerCase().includes(query) ||
          log.pid.includes(query) ||
          log.level.toLowerCase().includes(query);
        if (!match) return false;
      }

      return true;
    });
  }, [logs, filterLevel, filterByCurrentApp, activeApp, searchQuery]);

  return {
    logs: filteredLogs,
    rawLogsCount: logs.length,
    isConnected,
    isPaused,
    filterLevel,
    searchQuery,
    filterByCurrentApp,
    activeApp,
    latestCrash,
    crashVault,
    setFilterLevel,
    setSearchQuery,
    setFilterByCurrentApp,
    clearLogs,
    clearCrashVault,
    togglePause,
    dismissCrash,
    exportLogs,
    exportCrashReport,
  };
}
