'use client';

import { useState, useCallback } from 'react';
import type { SystemLogs } from '@/features/types';

const MAX_LOG_ENTRIES = 100;
type SystemLogType = SystemLogs['type'];

interface UseSystemLogsResult {
  logs: SystemLogs[];
  addLog: (message: string, type?: SystemLogType) => void;
  clearLogs: () => void;
}

function createSystemLogEntry(message: string, type: SystemLogType): SystemLogs {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toLocaleTimeString(),
    message,
    type,
  };
}

/**
 * In-memory circular log buffer (max 100 entries).
 * Each entry gets a localized timestamp and unique client-side ID.
 */
export function useSystemLogs(): UseSystemLogsResult {
  const [logs, setLogs] = useState<SystemLogs[]>([]);

  const addLog = useCallback((message: string, type: SystemLogType = 'info') => {
    setLogs((prev) => {
      const entry = createSystemLogEntry(message, type);
      return [...prev.slice(-(MAX_LOG_ENTRIES - 1)), entry];
    });
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, addLog, clearLogs };
}
