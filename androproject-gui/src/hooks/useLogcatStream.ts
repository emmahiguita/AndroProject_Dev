// QUÉ HACE: Hook React que consume el stream SSE `/api/logcat`, agrupa logs
//           en micro-batches de 100ms, detecta crashes y filtra en tiempo real.
// CÓMO FUNCIONA: Mantiene EventSource conectado por `serial`, acumula líneas
//           en buffer circular (máx. 800), delega el armado forense de crashes
//           a `logcatCrashBuilder.ts` y limpia cola/timers al desmontar o limpiar.
// POR QUÉ: Evitar saturación de renders en React y mantener el hook bajo
//           200 líneas (SRP) sin fugas de timers o buffers fantasma tras `clearLogs`.

'use client';
import { apiUrl } from '@/lib/api-url';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { LogcatEntry } from '@/features/logcat-types';
import {
  LEVEL_WEIGHT,
  buildRawCrashDump,
  detectCrashType,
  downloadTextFile,
  extractCrashPackage,
  isCrashTriggerLine,
  isStackContinuationLine,
  type LogLevel,
  type StructuredCrash,
} from './logcatCrashBuilder';

export type { LogLevel, StructuredCrash };

const MAX_LOGS_BUFFER = 800;

interface UseLogcatStreamOptions {
  serial?: string;
  enabled?: boolean;
  onAppSwitch?: (pkg: string, activity?: string) => void;
  onCrash?: (crash: StructuredCrash) => void;
}

export function useLogcatStream({ serial, enabled = true, onAppSwitch, onCrash }: UseLogcatStreamOptions) {
  const [logs, setLogs] = useState<LogcatEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [filterLevel, setFilterLevel] = useState<LogLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByCurrentApp, setFilterByCurrentApp] = useState(false);
  const [activeApp, setActiveApp] = useState<{ packageName: string; activityName?: string } | null>(null);
  const [latestCrash, setLatestCrash] = useState<StructuredCrash | null>(null);
  const [crashVault, setCrashVault] = useState<StructuredCrash[]>([]);

  const isPausedRef = useRef(isPaused); isPausedRef.current = isPaused;
  const logsRef = useRef<LogcatEntry[]>([]); logsRef.current = logs;
  const activeAppRef = useRef(activeApp); activeAppRef.current = activeApp;
  const onAppSwitchRef = useRef(onAppSwitch); onAppSwitchRef.current = onAppSwitch;
  const onCrashRef = useRef(onCrash); onCrashRef.current = onCrash;

  const incomingQueueRef = useRef<LogcatEntry[]>([]);
  const currentCrashRef = useRef<StructuredCrash | null>(null);
  const crashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const flushInterval = setInterval(() => {
      if (incomingQueueRef.current.length === 0) return;
      const batch = incomingQueueRef.current.splice(0, incomingQueueRef.current.length);
      setLogs((prev) => {
        const combined = [...prev, ...batch];
        return combined.length > MAX_LOGS_BUFFER ? combined.slice(combined.length - MAX_LOGS_BUFFER) : combined;
      });
    }, 100);
    return () => clearInterval(flushInterval);
  }, []);

  const finalizeCrash = useCallback(() => {
    const building = currentCrashRef.current;
    if (!building) return;
    const finishedCrash: StructuredCrash = { ...building, rawDump: buildRawCrashDump(building, serial) };
    setLatestCrash(finishedCrash);
    setCrashVault((prev) =>
      prev.length > 0 && prev[0].packageName === finishedCrash.packageName && prev[0].pid === finishedCrash.pid
        ? [finishedCrash, ...prev.slice(1)]
        : [finishedCrash, ...prev.slice(0, 49)],
    );
    onCrashRef.current?.(finishedCrash);
    currentCrashRef.current = null;
  }, [serial]);

  const scheduleCrashFinalize = useCallback(() => {
    if (crashTimerRef.current) clearTimeout(crashTimerRef.current);
    crashTimerRef.current = setTimeout(finalizeCrash, 1200);
  }, [finalizeCrash]);

  useEffect(() => {
    if (!enabled || !serial) {
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
      setIsConnected(false);
      return;
    }

    const es = new EventSource(apiUrl(`/api/logcat?serial=${encodeURIComponent(serial)}`));
    eventSourceRef.current = es;
    es.onopen = () => setIsConnected(true);
    es.onerror = () => setIsConnected(false);

    es.onmessage = (event) => {
      if (isPausedRef.current) return;
      try {
        const entry: LogcatEntry = JSON.parse(event.data);
        if (entry.isAppSwitch && entry.packageName) {
          setActiveApp({ packageName: entry.packageName, activityName: entry.activityName });
          onAppSwitchRef.current?.(entry.packageName, entry.activityName);
        }

        const isCrashTrigger = isCrashTriggerLine(entry);
        const isStackLine = isStackContinuationLine(entry.message);

        if (isCrashTrigger && !isStackLine) {
          const building = currentCrashRef.current;
          const isSame = building && (building.pid === entry.pid || (entry.pid === '0' && building.packageName.includes(entry.tag)));
          if (isSame && building) {
            if (entry.message.includes('Exception') || entry.message.includes('Error')) building.reason = entry.message;
            building.stackTrace.push(entry.raw);
          } else {
            if (building) finalizeCrash();
            currentCrashRef.current = {
              id: `crash-${Date.now()}-${entry.pid}`,
              timestamp: entry.timestamp,
              packageName: extractCrashPackage(entry, activeAppRef.current?.packageName),
              activityName: activeAppRef.current?.activityName,
              pid: entry.pid, tid: entry.tid,
              crashType: detectCrashType(entry),
              title: entry.message, reason: entry.message,
              stackTrace: [entry.raw], contextLogs: logsRef.current.slice(-20), rawDump: '',
            };
          }
          scheduleCrashFinalize();
        } else if (isStackLine && currentCrashRef.current) {
          currentCrashRef.current.stackTrace.push(entry.raw);
          scheduleCrashFinalize();
        }

        incomingQueueRef.current.push(entry);
      } catch { /* Ignora chunks no JSON */ }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      incomingQueueRef.current = [];
      if (crashTimerRef.current) clearTimeout(crashTimerRef.current);
    };
  }, [serial, enabled, finalizeCrash, scheduleCrashFinalize]);

  const clearLogs = useCallback(() => {
    incomingQueueRef.current = [];
    setLogs([]);
    setLatestCrash(null);
  }, []);
  const clearCrashVault = useCallback(() => { setCrashVault([]); setLatestCrash(null); }, []);
  const togglePause = useCallback(() => setIsPaused((p) => !p), []);
  const dismissCrash = useCallback(() => setLatestCrash(null), []);

  const exportLogs = useCallback(() => {
    if (logs.length === 0) return;
    const text = logs.map((l) => `${l.timestamp} ${l.pid} ${l.tid} ${l.level} ${l.tag}: ${l.message}`).join('\n');
    downloadTextFile(`androproject-logcat-${serial || 'device'}-${Date.now()}.log`, text);
  }, [logs, serial]);

  const exportCrashReport = useCallback((crash: StructuredCrash) => {
    downloadTextFile(`CRASH_REPORT-${crash.packageName.replace(/[^a-zA-Z0-9._-]/g, '_')}-${Date.now()}.txt`, crash.rawDump);
  }, []);

  const filteredLogs = useMemo(() => {
    const minWeight = LEVEL_WEIGHT[filterLevel] || 0;
    const query = searchQuery.trim().toLowerCase();
    const currentPkg = activeApp?.packageName?.toLowerCase();

    return logs.filter((log) => {
      if (filterLevel !== 'ALL' && (LEVEL_WEIGHT[log.level] || 1) < minWeight) return false;
      if (filterByCurrentApp && currentPkg) {
        const hit = log.packageName?.toLowerCase().includes(currentPkg) ||
          log.tag.toLowerCase().includes(currentPkg) || log.message.toLowerCase().includes(currentPkg);
        if (!hit) return false;
      }
      if (query) {
        return log.tag.toLowerCase().includes(query) || log.message.toLowerCase().includes(query) ||
          log.pid.includes(query) || log.level.toLowerCase().includes(query);
      }
      return true;
    });
  }, [logs, filterLevel, filterByCurrentApp, activeApp, searchQuery]);

  return {
    logs: filteredLogs, rawLogsCount: logs.length, isConnected, isPaused,
    filterLevel, searchQuery, filterByCurrentApp, activeApp, latestCrash, crashVault,
    setFilterLevel, setSearchQuery, setFilterByCurrentApp,
    clearLogs, clearCrashVault, togglePause, dismissCrash, exportLogs, exportCrashReport,
  };
}
