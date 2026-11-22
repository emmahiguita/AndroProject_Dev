// ============================================================================
// ARCHIVO: LogcatCrashVault.tsx
// QUÉ HACE: Renderiza la Bóveda de Fallos forenses (crashes agrupados,
//           stacktraces completos, logs previos al fallo y exportación TXT).
// CÓMO FUNCIONA: Muestra lista deduplicada de crashes con tipografía de alto
//           contraste (`text-zinc-100`, `text-zinc-300`) sin textos tenues.
// POR QUÉ: Aislar la vista de bóveda manteniendo legibilidad y < 200L (SRP).
// ============================================================================

'use client';

import React from 'react';
import { ShieldAlert, Trash2, Check, Clock, FileText, Download, Copy } from 'lucide-react';
import type { StructuredCrash } from '@/hooks/useLogcatStream';
import type { DeduplicatedCrash } from './logcatHelpers';

interface LogcatCrashVaultProps {
  vault: DeduplicatedCrash[];
  totalCrashCount: number;
  selectedCrash: StructuredCrash | null;
  copiedId: string | null;
  onSelectCrash: (crash: StructuredCrash | null) => void;
  onClearVault: () => void;
  onExportCrash: (crash: StructuredCrash) => void;
  onCopy: (text: string, id: string) => void;
}

export const LogcatCrashVault: React.FC<LogcatCrashVaultProps> = ({
  vault, totalCrashCount, selectedCrash, copiedId,
  onSelectCrash, onClearVault, onExportCrash, onCopy,
}) => (
  <div className="flex-1 flex flex-col min-h-0 p-2.5 overflow-hidden space-y-2">
    <div className="flex items-center justify-between shrink-0">
      <div className="flex items-center gap-1.5 text-zinc-100 font-bold text-xs">
        <ShieldAlert size={14} className="text-zinc-300" />
        <span>Historial Forense de Fallos ({totalCrashCount})</span>
      </div>

      {totalCrashCount > 0 && (
        <button
          type="button"
          onClick={onClearVault}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800 text-[11px] font-medium transition-all cursor-pointer"
        >
          <Trash2 size={11} /><span>Vaciar Bóveda</span>
        </button>
      )}
    </div>

    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
      {vault.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 text-zinc-300 space-y-2">
          <Check size={28} className="text-zinc-400" />
          <p className="font-semibold text-zinc-200 text-xs">Cero fallos detectados</p>
          <p className="text-xs text-zinc-400 text-center max-w-xs">
            Cualquier excepción Java, crash nativo SIGSEGV o ANR se registrará aquí con su StackTrace forense completo.
          </p>
        </div>
      ) : (
        vault.map((crash) => {
          const isSelected = selectedCrash?.id === crash.id;
          return (
            <div
              key={crash.id}
              className={`rounded-xl border p-2.5 transition-all ${
                isSelected ? 'bg-zinc-900 border-zinc-600 shadow-lg' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900/70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-100 font-bold text-[10px] border border-zinc-700">
                      {crash.crashType}
                    </span>
                    {crash.occurrences > 1 && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-bold text-[10px] border border-zinc-700">
                        {crash.occurrences} eventos
                      </span>
                    )}
                    <span className="font-bold text-zinc-100 text-xs">{crash.packageName}</span>
                    <span className="text-zinc-300 text-[11px] font-mono">PID: {crash.pid}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono mt-1">
                    <Clock size={11} /><span>{crash.timestamp}</span>
                  </div>
                  <p className="font-mono text-xs text-zinc-200 mt-1 font-semibold break-all line-clamp-2">{crash.title}</p>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    type="button" onClick={() => onSelectCrash(isSelected ? null : crash)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 text-[11px] font-bold transition-all cursor-pointer"
                  >
                    <FileText size={11} /><span>{isSelected ? 'Ocultar' : 'Ver StackTrace'}</span>
                  </button>
                  <button
                    type="button" onClick={() => onExportCrash(crash)} title="Descargar informe forense completo en .txt"
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800 text-[11px] transition-all cursor-pointer"
                  >
                    <Download size={10} /><span>Guardar TXT</span>
                  </button>
                </div>
              </div>

              {isSelected && (
                <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-200">STACKTRACE COMPLETO:</span>
                    <button
                      type="button" onClick={() => onCopy(crash.rawDump, crash.id)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[11px] font-semibold transition-all"
                    >
                      {copiedId === crash.id ? <Check size={11} /> : <Copy size={11} />}
                      <span>Copiar Informe Completo</span>
                    </button>
                  </div>

                  <pre className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-[11px] whitespace-pre-wrap break-all max-h-56 overflow-y-auto select-text leading-relaxed">
                    {crash.stackTrace.join('\n')}
                  </pre>

                  {crash.contextLogs.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-zinc-300 block mb-1">ÚLTIMOS EVENTOS DEL SISTEMA ANTES DEL FALLO:</span>
                      <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-200 max-h-32 overflow-y-auto space-y-0.5 select-text">
                        {crash.contextLogs.map((l) => (
                          <div key={l.id} className="truncate">
                            <span className="text-zinc-400">[{l.timestamp.slice(6, 12)}]</span>{' '}
                            <span className="text-zinc-100 font-semibold">{l.tag}:</span> {l.message}
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
);
