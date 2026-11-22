// ============================================================================
// ARCHIVO: LogcatConsoleView.tsx
// QUÉ HACE: Renderiza la consola Logcat en vivo (filtros por nivel/texto/app,
//           pausa/limpiar/exportar, stream con auto-scroll y detalle por línea).
// CÓMO FUNCIONA: Mantiene auto-scroll dentro del contenedor sin usar
//           `scrollIntoView` (evita saltos de ventana) y delega copias al padre.
// POR QUÉ: Desacoplar la vista de consola mantiene `LogcatInspectorPanel.tsx`
//           modular y bajo el límite estricto de 200 líneas (SRP).
// ============================================================================

'use client';

import React, { useEffect, useRef } from 'react';
import { Terminal, Play, Pause, Trash2, Download, Search, Smartphone, Copy, Check } from 'lucide-react';
import type { LogcatEntry } from '@/app/api/logcat/route';
import type { LogLevel } from '@/hooks/useLogcatStream';
import { LEVEL_COLORS, type DeduplicatedLogEntry } from './logcatHelpers';

interface LogcatConsoleViewProps {
  serial?: string;
  logs: DeduplicatedLogEntry[];
  rawLogsCount: number;
  isPaused: boolean;
  filterLevel: LogLevel;
  searchQuery: string;
  filterByCurrentApp: boolean;
  activeApp: { packageName: string; activityName?: string } | null;
  autoScroll: boolean;
  selectedEntry: LogcatEntry | null;
  copiedId: string | null;
  setFilterLevel: (lvl: LogLevel) => void;
  setSearchQuery: (q: string) => void;
  setFilterByCurrentApp: (v: boolean) => void;
  setAutoScroll: (v: boolean) => void;
  setSelectedEntry: (entry: LogcatEntry | null) => void;
  onTogglePause: () => void;
  onClearLogs: () => void;
  onExportLogs: () => void;
  onCopy: (text: string, id: string) => void;
  onCopyAppLogs: () => void;
}

export const LogcatConsoleView: React.FC<LogcatConsoleViewProps> = ({
  serial, logs, rawLogsCount, isPaused, filterLevel, searchQuery,
  filterByCurrentApp, activeApp, autoScroll, selectedEntry, copiedId,
  setFilterLevel, setSearchQuery, setFilterByCurrentApp, setAutoScroll,
  setSelectedEntry, onTogglePause, onClearLogs, onExportLogs, onCopy, onCopyAppLogs,
}) => {
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && listContainerRef.current && !isPaused) {
      listContainerRef.current.scrollTop = listContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isPaused]);

  return (
    <>
      <div className="px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-950/70 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {(['ALL', 'V', 'D', 'I', 'W', 'E', 'F'] as LogLevel[]).map((lvl) => (
            <button
              key={lvl} type="button" onClick={() => setFilterLevel(lvl)}
              className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-medium border transition-colors cursor-pointer ${
                filterLevel === lvl ? 'bg-zinc-800 text-zinc-100 border-zinc-700 shadow-sm' : 'bg-zinc-900/40 text-zinc-400 border-zinc-800/80 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {lvl === 'ALL' ? 'Todos' : lvl}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onTogglePause} title={isPaused ? 'Reanudar stream' : 'Pausar stream'}
            className={`p-1.5 rounded-md border transition-colors cursor-pointer ${isPaused ? 'bg-zinc-800 text-amber-300 border-zinc-700' : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border-zinc-800'}`}>
            {isPaused ? <Play size={11} fill="currentColor" /> : <Pause size={11} fill="currentColor" />}
          </button>
          <button type="button" onClick={onClearLogs} title="Limpiar logs" className="p-1.5 rounded-md bg-zinc-900/80 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 border border-zinc-800 transition-colors cursor-pointer">
            <Trash2 size={11} />
          </button>
          <button type="button" onClick={onExportLogs} title="Descargar registro (.log)" className="p-1.5 rounded-md bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800 transition-colors cursor-pointer">
            <Download size={11} />
          </button>
        </div>
      </div>

      <div className="px-3 py-1.5 bg-zinc-950/40 border-b border-zinc-800/50 flex items-center justify-between gap-2 shrink-0">
        <div className="relative flex-1">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por Tag, PID, texto, excepción..."
            className="w-full pl-7 pr-5 py-1 rounded-md bg-zinc-900/60 border border-zinc-800 text-zinc-200 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 text-xs">✕</button>
          )}
        </div>

        {activeApp?.packageName && (
          <>
            <button type="button" onClick={() => setFilterByCurrentApp(!filterByCurrentApp)} title="Filtrar consola únicamente por la app activa"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono border transition-colors cursor-pointer shrink-0 ${
                filterByCurrentApp ? 'bg-zinc-800 text-zinc-200 border-zinc-700 font-medium' : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border-zinc-800'
              }`}>
              <Smartphone size={10} className={filterByCurrentApp ? 'text-zinc-200' : 'text-zinc-500'} />
              <span>{filterByCurrentApp ? 'Solo App' : 'Todas'}</span>
            </button>
            <button type="button" onClick={onCopyAppLogs} title="Copiar todos los logs de esta aplicación"
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 text-[10px] font-mono transition-colors cursor-pointer shrink-0">
              {copiedId === 'app-logs' ? <><Check size={10} className="text-emerald-400" /><span>Copiado</span></> : <><Copy size={10} /><span>Copiar</span></>}
            </button>
          </>
        )}

        <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono shrink-0">
          <span>{logs.length} / {rawLogsCount}</span>
          <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 hover:text-zinc-200 select-none">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="accent-zinc-200 w-3 h-3 cursor-pointer" />
            <span>Auto-scroll</span>
          </label>
        </div>
      </div>

      <div ref={listContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1.5 font-mono text-[10px] space-y-0.5 select-text">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-white/30 space-y-2">
            <Terminal size={24} className="opacity-40" />
            <p>No hay logs para mostrar con los filtros actuales</p>
            {serial && <p className="text-[9px] text-white/20">Stream ADB conectado y listo...</p>}
          </div>
        ) : (
          logs.map((entry) => {
            const colors = LEVEL_COLORS[entry.level] || LEVEL_COLORS.I;
            const isSelected = selectedEntry?.id === entry.id;
            return (
              <div
                key={entry.id} onClick={() => setSelectedEntry(entry)}
                className={`group flex items-start gap-1.5 px-1.5 py-0.5 rounded cursor-pointer transition-colors leading-relaxed ${colors.bg} ${
                  isSelected ? 'bg-zinc-800 ring-1 ring-zinc-500' : ''
                } ${entry.isCrash ? 'border-l-2 border-zinc-500 pl-2 bg-zinc-900/80' : ''}`}
              >
                <span className="text-white/30 text-[9px] shrink-0">{entry.timestamp.slice(6, 12)}</span>
                <span className={`px-1 py-0 rounded text-[9px] font-bold border shrink-0 ${colors.badge}`}>{entry.level}</span>
                <span className="text-white/25 text-[9px] shrink-0 w-8 text-right font-mono truncate">{entry.pid}</span>
                <span className="text-zinc-200 font-semibold shrink-0 max-w-[120px] truncate" title={entry.tag}>{entry.tag}:</span>
                <span className={`flex-1 break-all ${colors.text}`}>{entry.message}</span>
                {entry.repeatCount > 1 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-zinc-700 text-zinc-100 font-bold text-[9px] shrink-0">×{entry.repeatCount}</span>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); onCopy(entry.raw, entry.id); }} title="Copiar línea completa"
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/40 hover:text-white hover:bg-white/10 transition-all shrink-0">
                  {copiedId === entry.id ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                </button>
              </div>
            );
          })
        )}
      </div>

      {selectedEntry && (
        <div className="p-3 border-t border-zinc-800 bg-zinc-900 shrink-0 max-h-48 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[9px] ${LEVEL_COLORS[selectedEntry.level]?.badge}`}>Nivel {selectedEntry.level}</span>
              <span className="font-bold text-white text-xs">{selectedEntry.tag}</span>
              <span className="text-white/40 text-[10px]">PID: {selectedEntry.pid} | TID: {selectedEntry.tid}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => onCopy(selectedEntry.raw, 'modal')} className="flex items-center gap-1 px-2 py-1 rounded bg-white/[0.06] hover:bg-white/[0.1] text-white text-[10px] font-semibold transition-all">
                {copiedId === 'modal' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}<span>Copiar</span>
              </button>
              <button type="button" onClick={() => setSelectedEntry(null)} className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.1] text-white/60 hover:text-white text-[10px]">Cerrar</button>
            </div>
          </div>
          <pre className="p-2 rounded bg-black/60 border border-white/5 text-white/90 font-mono text-[10px] whitespace-pre-wrap break-all select-text">{selectedEntry.raw}</pre>
        </div>
      )}
    </>
  );
};
