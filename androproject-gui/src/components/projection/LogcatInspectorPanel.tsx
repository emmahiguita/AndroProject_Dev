// ============================================================================
// ARCHIVO: LogcatInspectorPanel.tsx
// QUÉ HACE: Orquestador del inspector Logcat & Crashes en el estudio de
//           proyección (consola en vivo, bóveda forense y diagnóstico por app).
// CÓMO FUNCIONA: Conecta `useLogcatStream`, deduplica logs y crashes,
//           gestiona `copyToClipboard` con temporizador único y limpieza al
//           desmontar, y delega la UI a `LogcatHeaderBar`, `LogcatConsoleView`
//           y `LogcatCrashVault`.
// POR QUÉ: Reducir este componente de 708 líneas a < 120 líneas (SRP) y
//           eliminar fugas de timers `setTimeout` y lógica duplicada de filtrado.
// ============================================================================

'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLogcatStream, type StructuredCrash } from '@/hooks/useLogcatStream';
import type { LogcatEntry } from '@/app/api/logcat/route';
import {
  buildActiveAppDiagnosis,
  deduplicateLogs,
  deduplicateVault,
  filterLogsByPackage,
} from './logcatHelpers';
import { LogcatHeaderBar } from './LogcatHeaderBar';
import { LogcatConsoleView } from './LogcatConsoleView';
import { LogcatCrashVault } from './LogcatCrashVault';

interface LogcatInspectorPanelProps {
  serial?: string;
  dark?: boolean;
}

export const LogcatInspectorPanel: React.FC<LogcatInspectorPanelProps> = ({ serial }) => {
  const stream = useLogcatStream({ serial, enabled: Boolean(serial) });
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'vault'>('console');
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<LogcatEntry | null>(null);
  const [selectedCrash, setSelectedCrash] = useState<StructuredCrash | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const copyToClipboard = useCallback((text: string, id: string, durationMs = 2000) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopiedId(null);
      copyTimerRef.current = null;
    }, durationMs);
  }, []);

  const deduplicatedLogs = useMemo(() => deduplicateLogs(stream.logs), [stream.logs]);
  const deduplicatedVault = useMemo(() => deduplicateVault(stream.crashVault), [stream.crashVault]);

  const activeAppErrors = useMemo(() => {
    if (!stream.activeApp?.packageName) return 0;
    return filterLogsByPackage(deduplicatedLogs, stream.activeApp.packageName)
      .filter((l) => l.level === 'E' || l.level === 'F').length;
  }, [stream.activeApp, deduplicatedLogs]);

  const handleCopyDiagnosis = useCallback(() => {
    if (!stream.activeApp?.packageName) {
      copyToClipboard('No se ha detectado ninguna app activa en primer plano aún.', 'app-diag');
      return;
    }
    const report = buildActiveAppDiagnosis(serial, stream.activeApp, deduplicatedLogs, stream.crashVault);
    copyToClipboard(report, 'app-diag', 2500);
  }, [serial, stream.activeApp, deduplicatedLogs, stream.crashVault, copyToClipboard]);

  const handleCopyAppLogs = useCallback(() => {
    if (!stream.activeApp?.packageName) return;
    const text = filterLogsByPackage(deduplicatedLogs, stream.activeApp.packageName).map((l) => l.raw).join('\n');
    copyToClipboard(text || 'No hay logs registrados para esta app aún.', 'app-logs');
  }, [stream.activeApp, deduplicatedLogs, copyToClipboard]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-950 text-xs font-sans overflow-hidden">
      <LogcatHeaderBar
        activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab}
        consoleCount={deduplicatedLogs.length} vaultCount={deduplicatedVault.length}
        activeApp={stream.activeApp} activeAppErrors={activeAppErrors}
        copiedId={copiedId} onCopyDiagnosis={handleCopyDiagnosis}
        isConnected={stream.isConnected} isPaused={stream.isPaused}
        latestCrash={stream.latestCrash}
        onOpenLatestCrash={(crash) => { setSelectedCrash(crash); setActiveSubTab('vault'); }}
        onDismissCrash={stream.dismissCrash}
      />

      {activeSubTab === 'console' ? (
        <LogcatConsoleView
          serial={serial} logs={deduplicatedLogs} rawLogsCount={stream.rawLogsCount}
          isPaused={stream.isPaused} filterLevel={stream.filterLevel} searchQuery={stream.searchQuery}
          filterByCurrentApp={stream.filterByCurrentApp} activeApp={stream.activeApp}
          autoScroll={autoScroll} selectedEntry={selectedEntry} copiedId={copiedId}
          setFilterLevel={stream.setFilterLevel} setSearchQuery={stream.setSearchQuery}
          setFilterByCurrentApp={stream.setFilterByCurrentApp} setAutoScroll={setAutoScroll}
          setSelectedEntry={setSelectedEntry} onTogglePause={stream.togglePause}
          onClearLogs={stream.clearLogs} onExportLogs={stream.exportLogs}
          onCopy={copyToClipboard} onCopyAppLogs={handleCopyAppLogs}
        />
      ) : (
        <LogcatCrashVault
          vault={deduplicatedVault} totalCrashCount={stream.crashVault.length}
          selectedCrash={selectedCrash} copiedId={copiedId}
          onSelectCrash={setSelectedCrash} onClearVault={stream.clearCrashVault}
          onExportCrash={stream.exportCrashReport} onCopy={copyToClipboard}
        />
      )}
    </div>
  );
};
