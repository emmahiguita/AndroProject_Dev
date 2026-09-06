'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Terminal, Play, Pause, Trash2, Download, Search, AlertOctagon,
  Copy, Check, Bug, ShieldAlert, Sparkles, Filter, ExternalLink,
  ChevronDown, ChevronRight, Smartphone, AlertTriangle, FileText,
  Clock, Activity, Layers, Flame,
} from 'lucide-react';
import { useLogcatStream, LogLevel, StructuredCrash } from '@/hooks/useLogcatStream';
import type { LogcatEntry } from '@/app/api/logcat/route';

interface LogcatInspectorPanelProps {
  serial?: string;
  dark?: boolean;
}

const LEVEL_COLORS: Record<string, { badge: string; text: string; bg: string }> = {
  V: { badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30', text: 'text-slate-400', bg: 'hover:bg-slate-500/5' },
  D: { badge: 'bg-sky-500/20 text-sky-400 border-sky-500/30', text: 'text-sky-300', bg: 'hover:bg-sky-500/5' },
  I: { badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', text: 'text-emerald-300', bg: 'hover:bg-emerald-500/5' },
  W: { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30', text: 'text-amber-300', bg: 'hover:bg-amber-500/5' },
  E: { badge: 'bg-red-500/25 text-red-400 border-red-500/40', text: 'text-red-300 font-medium', bg: 'bg-red-500/10 hover:bg-red-500/15' },
  F: { badge: 'bg-red-600/35 text-red-200 border-red-500/50', text: 'text-red-200 font-bold', bg: 'bg-red-600/20 hover:bg-red-600/25' },
  S: { badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30', text: 'text-purple-300', bg: 'hover:bg-purple-500/5' },
};

export const LogcatInspectorPanel: React.FC<LogcatInspectorPanelProps> = ({
  serial,
  dark = true,
}) => {
  const {
    logs,
    rawLogsCount,
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
  } = useLogcatStream({ serial, enabled: Boolean(serial) });

  const [activeSubTab, setActiveSubTab] = useState<'console' | 'vault'>('console');
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<LogcatEntry | null>(null);
  const [selectedCrash, setSelectedCrash] = useState<StructuredCrash | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Deduplicate consecutive identical logs with a repeat counter
  const deduplicatedLogs = useMemo(() => {
    const result: Array<LogcatEntry & { repeatCount: number }> = [];
    for (const log of logs) {
      const last = result[result.length - 1];
      if (
        last &&
        last.level === log.level &&
        last.tag === log.tag &&
        last.pid === log.pid &&
        last.message === log.message
      ) {
        last.repeatCount = (last.repeatCount || 1) + 1;
        last.timestamp = log.timestamp;
      } else {
        result.push({ ...log, repeatCount: 1 });
      }
    }
    return result;
  }, [logs]);

  // Auto-scroll inside list container ONLY — NEVER call scrollIntoView to prevent window jump
  useEffect(() => {
    if (activeSubTab === 'console' && autoScroll && listContainerRef.current && !isPaused) {
      listContainerRef.current.scrollTop = listContainerRef.current.scrollHeight;
    }
  }, [deduplicatedLogs, autoScroll, isPaused, activeSubTab]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Count errors specifically for the active foreground app
  const activeAppErrors = useMemo(() => {
    if (!activeApp?.packageName) return 0;
    const pkg = activeApp.packageName.toLowerCase();
    return deduplicatedLogs.filter(
      (l) =>
        (l.level === 'E' || l.level === 'F') &&
        (l.message.toLowerCase().includes(pkg) ||
          l.tag.toLowerCase().includes(pkg) ||
          l.packageName?.toLowerCase() === pkg)
    ).length;
  }, [activeApp, deduplicatedLogs]);

  // Copy structured forensic diagnosis of the current foreground app
  const copyActiveAppDiagnosis = () => {
    if (!activeApp?.packageName) {
      navigator.clipboard.writeText('No se ha detectado ninguna app activa en primer plano aún.');
      setCopiedId('app-diag');
      setTimeout(() => setCopiedId(null), 2000);
      return;
    }

    const pkg = activeApp.packageName;
    const act = activeApp.activityName || 'Desconocida';
    const appLogs = deduplicatedLogs.filter(
      (l) =>
        l.message.toLowerCase().includes(pkg.toLowerCase()) ||
        l.tag.toLowerCase().includes(pkg.toLowerCase()) ||
        l.packageName?.toLowerCase() === pkg.toLowerCase()
    );
    const errors = appLogs.filter((l) => l.level === 'E' || l.level === 'F');
    const crashes = crashVault.filter((c) => c.packageName.toLowerCase().includes(pkg.toLowerCase()));

    const report = [
      `======================================================================`,
      `DIAGNÓSTICO FORENSE DE APLICACIÓN - ANDROPROJECT`,
      `======================================================================`,
      `Dispositivo : ${serial || 'Desconocido'}`,
      `Fecha       : ${new Date().toLocaleString()}`,
      `Paquete     : ${pkg}`,
      `Activity    : ${act}`,
      `Estado      : ${errors.length === 0 && crashes.length === 0 ? 'ESTABLE' : 'ERRORES DETECTADOS'}`,
      `----------------------------------------------------------------------`,
      `[RESUMEN OPERATIVO]`,
      `- Total eventos registrados : ${appLogs.length}`,
      `- Errores / Excepciones      : ${errors.length}`,
      `- Fallos críticos (Crashes)  : ${crashes.length}`,
      ``,
      crashes.length > 0
        ? [
            `[CRASHES Y STACKTRACES CRÍTICOS]`,
            ...crashes.map(
              (c) =>
                `-- Fallo: ${c.crashType} (PID: ${c.pid}) a las ${c.timestamp}\nTitulo: ${c.title}\nStackTrace:\n${c.stackTrace.join('\n')}\n`
            ),
          ].join('\n')
        : `[CRASHES]: Ningún fallo fatal registrado para esta aplicación.`,
      ``,
      `[ÚLTIMOS LOGS DE LA APLICACIÓN]`,
      ...appLogs.slice(-40).map((l) => `[${l.timestamp}] [${l.level}/${l.tag}] (PID:${l.pid}) ${l.message}`),
      `======================================================================`,
    ].join('\n');

    navigator.clipboard.writeText(report);
    setCopiedId('app-diag');
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Group duplicate crashes in vault by package + pid + crashType
  const deduplicatedVault = useMemo(() => {
    const map = new Map<string, StructuredCrash & { occurrences: number }>();
    for (const c of crashVault) {
      const key = `${c.packageName}_${c.pid}_${c.crashType}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...c, occurrences: 1 });
      } else {
        existing.occurrences++;
        if (c.stackTrace.length > existing.stackTrace.length) {
          existing.stackTrace = c.stackTrace;
          existing.rawDump = c.rawDump;
          existing.title = c.title;
        }
      }
    }
    return Array.from(map.values());
  }, [crashVault]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-950 text-xs font-sans overflow-hidden">
      {/* ═══ Header Bar: Sub-Tabs & Live State ═══ */}
      <div className="px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/60 shrink-0 flex items-center justify-between gap-2 backdrop-blur-md">
        {/* Sub-Tabs: Consola vs Bóveda de Fallos */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('console')}
            className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeSubTab === 'console'
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
            }`}
          >
            <Terminal size={12} />
            <span>Consola ({deduplicatedLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('vault')}
            className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer relative ${
              activeSubTab === 'vault'
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
            }`}
          >
            <ShieldAlert size={12} className={deduplicatedVault.length > 0 ? 'text-rose-400' : ''} />
            <span>Bóveda de Fallos ({deduplicatedVault.length})</span>
            {deduplicatedVault.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute right-1.5 top-1.5" />
            )}
          </button>
        </div>

        {/* Right Info: Detected App + Forensic Copy + Live Pill */}
        <div className="flex items-center gap-1.5 min-w-0">
          {activeApp?.packageName && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 min-w-0 max-w-[280px]">
              <Smartphone size={11} className="text-zinc-400 shrink-0" />
              <span className="truncate font-mono font-medium" title={`${activeApp.packageName} (${activeApp.activityName || ''})`}>
                {activeApp.packageName}
              </span>
              {activeAppErrors > 0 ? (
                <span className="px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-medium shrink-0">
                  {activeAppErrors} err
                </span>
              ) : (
                <span className="px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 text-[9px] font-medium shrink-0">
                  ok
                </span>
              )}

              {/* One-Click Copy App Diagnosis */}
              <button
                type="button"
                onClick={copyActiveAppDiagnosis}
                title="Copiar diagnóstico forense de la app"
                className="ml-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-[9px] font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                {copiedId === 'app-diag' ? (
                  <>
                    <Check size={9} className="text-emerald-400" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy size={9} />
                    <span>Diagnóstico</span>
                  </>
                )}
              </button>
            </div>
          )}

          <span
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border shrink-0 ${
              isConnected
                ? isPaused
                  ? 'bg-zinc-900 text-amber-300 border-amber-900/50'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected
                  ? isPaused
                    ? 'bg-amber-400'
                    : 'bg-emerald-500'
                  : 'bg-zinc-600'
              }`}
            />
            {isConnected ? (isPaused ? 'Pausado' : 'En vivo') : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* ═══ Crash Alert Banner (If Fatal/Crash detected) ═══ */}
      {latestCrash && (
        <div className="mx-2 mt-1.5 p-2 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 shrink-0 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Flame size={14} className="text-rose-400 shrink-0" />
            <div className="min-w-0 truncate">
              <span className="font-semibold text-xs text-rose-100 mr-2">Fallo Detectado</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-900/80 border border-rose-700 font-mono text-rose-300 mr-2">
                {latestCrash.crashType}
              </span>
              <span className="font-mono text-[10px] text-rose-200 truncate">
                {latestCrash.packageName} (PID: {latestCrash.pid})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedCrash(latestCrash);
                setActiveSubTab('vault');
              }}
              className="px-2 py-0.5 rounded-md bg-rose-900 hover:bg-rose-800 text-white font-medium text-[10px] border border-rose-700 transition-colors cursor-pointer"
            >
              StackTrace
            </button>
            <button
              type="button"
              onClick={dismissCrash}
              className="px-1.5 py-0.5 rounded-md text-rose-400 hover:text-white hover:bg-rose-900/50 transition-colors text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* VISTA 1: CONSOLA EN VIVO                                         */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'console' && (
        <>
          {/* Filter & Control Toolbar */}
          <div className="px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-950/70 flex items-center justify-between gap-2 shrink-0">
            {/* Level Selector Pills */}
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {(['ALL', 'V', 'D', 'I', 'W', 'E', 'F'] as LogLevel[]).map((lvl) => {
                const active = filterLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setFilterLevel(lvl)}
                    className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-medium border transition-colors cursor-pointer ${
                      active
                        ? 'bg-zinc-800 text-zinc-100 border-zinc-700 shadow-sm'
                        : 'bg-zinc-900/40 text-zinc-400 border-zinc-800/80 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {lvl === 'ALL' ? 'Todos' : lvl}
                  </button>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={togglePause}
                title={isPaused ? 'Reanudar stream' : 'Pausar stream'}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  isPaused
                    ? 'bg-zinc-800 text-amber-300 border-zinc-700'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border-zinc-800'
                }`}
              >
                {isPaused ? <Play size={11} fill="currentColor" /> : <Pause size={11} fill="currentColor" />}
              </button>

              <button
                type="button"
                onClick={clearLogs}
                title="Limpiar logs"
                className="p-1.5 rounded-md bg-zinc-900/80 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 border border-zinc-800 transition-colors cursor-pointer"
              >
                <Trash2 size={11} />
              </button>

              <button
                type="button"
                onClick={exportLogs}
                title="Descargar registro (.log)"
                className="p-1.5 rounded-md bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800 transition-colors cursor-pointer"
              >
                <Download size={11} />
              </button>
            </div>
          </div>

          {/* Search & Stats Bar */}
          <div className="px-3 py-1.5 bg-zinc-950/40 border-b border-zinc-800/50 flex items-center justify-between gap-2 shrink-0">
            <div className="relative flex-1">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por Tag, PID, texto, excepción..."
                className="w-full pl-7 pr-5 py-1 rounded-md bg-zinc-900/60 border border-zinc-800 text-zinc-200 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick App Scope Filter */}
            {activeApp?.packageName && (
              <button
                type="button"
                onClick={() => setFilterByCurrentApp(!filterByCurrentApp)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono border transition-colors cursor-pointer shrink-0 ${
                  filterByCurrentApp
                    ? 'bg-zinc-800 text-zinc-200 border-zinc-700 font-medium'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                }`}
                title="Filtrar consola únicamente por la app activa"
              >
                <Smartphone size={10} className={filterByCurrentApp ? 'text-zinc-200' : 'text-zinc-500'} />
                <span>{filterByCurrentApp ? 'Solo App' : 'Todas'}</span>
              </button>
            )}

            {/* Quick Copy App Logs */}
            {activeApp?.packageName && (
              <button
                type="button"
                onClick={() => {
                  const pkg = activeApp.packageName.toLowerCase();
                  const appLogs = deduplicatedLogs.filter(
                    (l) =>
                      l.message.toLowerCase().includes(pkg) ||
                      l.tag.toLowerCase().includes(pkg) ||
                      l.packageName?.toLowerCase() === pkg
                  );
                  const text = appLogs.map((l) => l.raw).join('\n');
                  navigator.clipboard.writeText(text || 'No hay logs registrados para esta app aún.');
                  setCopiedId('app-logs');
                  setTimeout(() => setCopiedId(null), 2000);
                }}
                title="Copiar todos los logs de esta aplicación"
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 text-[10px] font-mono transition-colors cursor-pointer shrink-0"
              >
                {copiedId === 'app-logs' ? (
                  <>
                    <Check size={10} className="text-emerald-400" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy size={10} />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            )}

            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono shrink-0">
              <span>{deduplicatedLogs.length} / {rawLogsCount}</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 hover:text-zinc-200 select-none">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="accent-zinc-200 w-3 h-3 cursor-pointer"
                />
                <span>Auto-scroll</span>
              </label>
            </div>
          </div>

          {/* Main Log Terminal Stream */}
          <div
            ref={listContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1.5 font-mono text-[10px] space-y-0.5 select-text"
          >
            {deduplicatedLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-white/30 space-y-2">
                <Terminal size={24} className="opacity-40" />
                <p>No hay logs para mostrar con los filtros actuales</p>
                {serial && <p className="text-[9px] text-white/20">Stream ADB conectado y listo...</p>}
              </div>
            ) : (
              deduplicatedLogs.map((entry) => {
                const colors = LEVEL_COLORS[entry.level] || LEVEL_COLORS.I;
                const isSelected = selectedEntry?.id === entry.id;

                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className={`group flex items-start gap-1.5 px-1.5 py-0.5 rounded cursor-pointer transition-colors leading-relaxed ${colors.bg} ${
                      isSelected ? 'bg-zinc-800 ring-1 ring-zinc-500' : ''
                    } ${entry.isCrash ? 'border-l-2 border-red-500 pl-2 bg-red-950/30' : ''}`}
                  >
                    <span className="text-white/30 text-[9px] shrink-0">{entry.timestamp.slice(6, 12)}</span>
                    <span className={`px-1 py-0 rounded text-[9px] font-bold border shrink-0 ${colors.badge}`}>
                      {entry.level}
                    </span>
                    <span className="text-white/25 text-[9px] shrink-0 w-8 text-right font-mono truncate">
                      {entry.pid}
                    </span>
                    <span className="text-cyan-400/90 font-semibold shrink-0 max-w-[120px] truncate" title={entry.tag}>
                      {entry.tag}:
                    </span>
                    <span className={`flex-1 break-all ${colors.text}`}>
                      {entry.message}
                    </span>

                    {/* Deduplication Repeat Badge */}
                    {entry.repeatCount > 1 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[9px] shrink-0">
                        ×{entry.repeatCount}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(entry.raw, entry.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/40 hover:text-white hover:bg-white/10 transition-all shrink-0"
                      title="Copiar línea completa"
                    >
                      {copiedId === entry.id ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* VISTA 2: BÓVEDA DE FALLOS Y STACKTRACES COMPLETOS                */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'vault' && (
        <div className="flex-1 flex flex-col min-h-0 p-2.5 overflow-hidden space-y-2">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs">
              <ShieldAlert size={14} />
              <span>Historial Forense de Fallos ({crashVault.length})</span>
            </div>

            {crashVault.length > 0 && (
              <button
                type="button"
                onClick={clearCrashVault}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] hover:bg-red-500/20 text-white/50 hover:text-red-300 border border-white/10 text-[10px] transition-all cursor-pointer"
              >
                <Trash2 size={10} />
                <span>Vaciar Bóveda</span>
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {deduplicatedVault.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-56 text-white/30 space-y-2">
                <Check size={28} className="text-emerald-400/50" />
                <p className="font-semibold text-white/50">Cero fallos detectados</p>
                <p className="text-[10px] text-white/25 text-center max-w-xs">
                  Cualquier excepción Java, crash nativo SIGSEGV o ANR se registrará aquí con su StackTrace forense completo.
                </p>
              </div>
            ) : (
              deduplicatedVault.map((crash) => {
                const isSelected = selectedCrash?.id === crash.id;
                return (
                  <div
                    key={crash.id}
                    className={`rounded-xl border p-2.5 transition-all ${
                      isSelected
                        ? 'bg-red-950/40 border-red-500/60 ring-1 ring-red-500/40 shadow-lg'
                        : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-bold text-[9px] border border-red-500/30">
                            {crash.crashType}
                          </span>
                          {crash.occurrences > 1 && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold text-[9px] border border-amber-500/30">
                              {crash.occurrences} eventos
                            </span>
                          )}
                          <span className="font-bold text-white text-xs">{crash.packageName}</span>
                          <span className="text-white/40 text-[9px] font-mono">PID: {crash.pid}</span>
                        </div>

                        <div className="flex items-center gap-1 text-[9px] text-white/40 font-mono mt-1">
                          <Clock size={10} />
                          <span>{crash.timestamp}</span>
                        </div>

                        <p className="font-mono text-[10px] text-red-300/90 mt-1 font-semibold break-all line-clamp-2">
                          {crash.title}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedCrash(isSelected ? null : crash)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/35 text-red-200 border border-red-500/30 text-[10px] font-bold transition-all cursor-pointer"
                        >
                          <FileText size={11} />
                          <span>{isSelected ? 'Ocultar' : 'Ver StackTrace'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => exportCrashReport(crash)}
                          title="Descargar informe forense completo en .txt"
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.1] text-white/70 hover:text-white border border-white/10 text-[9px] transition-all cursor-pointer"
                        >
                          <Download size={10} />
                          <span>Guardar TXT</span>
                        </button>
                      </div>
                    </div>

                    {/* StackTrace & Context Dropdown */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-white/[0.08] space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-white/80">STACKTRACE COMPLETO:</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(crash.rawDump, crash.id)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white text-[10px] font-semibold transition-all"
                          >
                            {copiedId === crash.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            <span>Copiar Informe Completo</span>
                          </button>
                        </div>

                        <pre className="p-2.5 rounded-lg bg-black/80 border border-red-500/30 text-red-200 font-mono text-[9px] whitespace-pre-wrap break-all max-h-56 overflow-y-auto select-text leading-relaxed">
                          {crash.stackTrace.join('\n')}
                        </pre>

                        {/* Pre-crash Context Logs */}
                        {crash.contextLogs.length > 0 && (
                          <div className="pt-2">
                            <span className="text-[10px] font-bold text-white/50 block mb-1">
                              ÚLTIMOS EVENTOS DEL SISTEMA ANTES DEL FALLO:
                            </span>
                            <div className="p-2 rounded-lg bg-black/50 border border-white/5 font-mono text-[8px] text-white/60 max-h-32 overflow-y-auto space-y-0.5 select-text">
                              {crash.contextLogs.map((l) => (
                                <div key={l.id} className="truncate">
                                  <span className="text-white/30">[{l.timestamp.slice(6, 12)}]</span>{' '}
                                  <span className="text-cyan-400">{l.tag}:</span> {l.message}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ═══ Single Log Detail Modal (When clicking a row in console) ═══ */}
      {selectedEntry && activeSubTab === 'console' && (
        <div className="p-3 border-t border-zinc-800 bg-zinc-900 shrink-0 max-h-48 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[9px] ${LEVEL_COLORS[selectedEntry.level]?.badge}`}>
                Nivel {selectedEntry.level}
              </span>
              <span className="font-bold text-white text-xs">{selectedEntry.tag}</span>
              <span className="text-white/40 text-[10px]">PID: {selectedEntry.pid} | TID: {selectedEntry.tid}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copyToClipboard(selectedEntry.raw, 'modal')}
                className="flex items-center gap-1 px-2 py-1 rounded bg-white/[0.06] hover:bg-white/[0.1] text-white text-[10px] font-semibold transition-all"
              >
                {copiedId === 'modal' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                <span>Copiar</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.1] text-white/60 hover:text-white text-[10px]"
              >
                Cerrar
              </button>
            </div>
          </div>

          <pre className="p-2 rounded bg-black/60 border border-white/5 text-white/90 font-mono text-[10px] whitespace-pre-wrap break-all select-text">
            {selectedEntry.raw}
          </pre>
        </div>
      )}
    </div>
  );
};
