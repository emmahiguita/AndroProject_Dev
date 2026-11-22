// ============================================================================
// ARCHIVO: LogcatHeaderBar.tsx
// QUÉ HACE: Renderiza la barra superior del inspector Logcat (pestañas Consola
//           y Bóveda de Fallos, app en foco, botón Diagnóstico y banner de crash).
// CÓMO FUNCIONA: Componente presentacional puro que recibe conteos, estado de
//           conexión y callbacks para cambiar pestaña, copiar o descartar crash.
// POR QUÉ: Separar la cabecera mantiene `LogcatInspectorPanel.tsx` < 200 líneas.
// ============================================================================

'use client';

import React from 'react';
import { Terminal, ShieldAlert, Smartphone, Copy, Check, Flame } from 'lucide-react';
import type { StructuredCrash } from '@/hooks/useLogcatStream';

interface LogcatHeaderBarProps {
  activeSubTab: 'console' | 'vault';
  setActiveSubTab: (tab: 'console' | 'vault') => void;
  consoleCount: number;
  vaultCount: number;
  activeApp: { packageName: string; activityName?: string } | null;
  activeAppErrors: number;
  copiedId: string | null;
  onCopyDiagnosis: () => void;
  isConnected: boolean;
  isPaused: boolean;
  latestCrash: StructuredCrash | null;
  onOpenLatestCrash: (crash: StructuredCrash) => void;
  onDismissCrash: () => void;
}

export const LogcatHeaderBar: React.FC<LogcatHeaderBarProps> = ({
  activeSubTab, setActiveSubTab, consoleCount, vaultCount, activeApp,
  activeAppErrors, copiedId, onCopyDiagnosis, isConnected, isPaused,
  latestCrash, onOpenLatestCrash, onDismissCrash,
}) => (
  <>
    <div className="px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/60 shrink-0 flex items-center justify-between gap-2 backdrop-blur-md">
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
          <Terminal size={12} /><span>Consola ({consoleCount})</span>
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
          <ShieldAlert size={12} className={vaultCount > 0 ? 'text-rose-400' : ''} />
          <span>Bóveda de Fallos ({vaultCount})</span>
          {vaultCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute right-1.5 top-1.5" />}
        </button>
      </div>

      <div className="flex items-center gap-1.5 min-w-0">
        {activeApp?.packageName && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 min-w-0 max-w-[280px]">
            <Smartphone size={11} className="text-zinc-400 shrink-0" />
            <span className="truncate font-mono font-medium" title={`${activeApp.packageName} (${activeApp.activityName || ''})`}>
              {activeApp.packageName}
            </span>
            <span className={`px-1 py-0.2 rounded border text-[9px] font-medium shrink-0 ${
              activeAppErrors > 0 ? 'bg-zinc-800 text-rose-300 border-zinc-700' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}>
              {activeAppErrors > 0 ? `${activeAppErrors} err` : 'ok'}
            </span>
            <button
              type="button"
              onClick={onCopyDiagnosis}
              title="Copiar diagnóstico forense de la app"
              className="ml-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-[9px] font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              {copiedId === 'app-diag' ? <><Check size={9} className="text-emerald-400" /><span>Copiado</span></> : <><Copy size={9} /><span>Diagnóstico</span></>}
            </button>
          </div>
        )}

        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border shrink-0 bg-zinc-900 ${
          isConnected ? (isPaused ? 'text-zinc-200 border-zinc-700' : 'text-zinc-300 border-zinc-800') : 'text-zinc-500 border-zinc-800'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? (isPaused ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-zinc-600'}`} />
          {isConnected ? (isPaused ? 'Pausado' : 'En vivo') : 'Desconectado'}
        </span>
      </div>
    </div>

    {latestCrash && (
      <div className="mx-2 mt-1.5 p-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 shrink-0 flex items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Flame size={14} className="text-rose-400 shrink-0" />
          <div className="min-w-0 truncate">
            <span className="font-semibold text-xs text-zinc-100 mr-2">Fallo Detectado</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700 font-mono text-rose-300 mr-2">
              {latestCrash.crashType}
            </span>
            <span className="font-mono text-[10px] text-zinc-300 truncate">
              {latestCrash.packageName} (PID: {latestCrash.pid})
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onOpenLatestCrash(latestCrash)}
            className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-[10px] border border-zinc-700 transition-colors cursor-pointer"
          >
            StackTrace
          </button>
          <button type="button" onClick={onDismissCrash} className="px-1.5 py-0.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-xs">
            ✕
          </button>
        </div>
      </div>
    )}
  </>
);
