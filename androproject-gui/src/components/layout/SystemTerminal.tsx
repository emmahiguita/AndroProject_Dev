'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Terminal, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { SystemLogs } from '@/features/types';
import { useTheme } from '@/hooks/useTheme';

interface SystemTerminalProps {
  logs: SystemLogs[];
  onClearLogs: () => void;
}

function getLogBadgeClass(type: SystemLogs['type']): string {
  if (type === 'error') return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
  if (type === 'success') return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
  return 'bg-sky-500/20 text-sky-400 border border-sky-500/30';
}

function getLogMessageClass(type: SystemLogs['type']): string {
  if (type === 'error') return 'text-rose-300';
  if (type === 'success') return 'text-emerald-300';
  return 'text-slate-200';
}

export const SystemTerminal: React.FC<SystemTerminalProps> = ({ logs, onClearLogs }) => {
  const { dark } = useTheme();
  const boxRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const collapseIconClass = dark ? 'text-white/30' : 'text-slate-400';

  useEffect(() => {
    if (collapsed) return;
    const box = boxRef.current;
    if (!box) return;
    box.scrollTo({ top: box.scrollHeight, behavior: 'auto' });
  }, [logs, collapsed]);

  return (
    <section className={`rounded-xl border p-2.5 shrink-0 mt-3 transition-all ${dark ? 'bg-white/[0.025] border-white/[0.07]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex items-center justify-between px-0.5">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-1.5 text-left focus:outline-none group cursor-pointer"
        >
          <Terminal size={12} className="text-[#22c97d]" />
          <p className={`text-[10px] uppercase tracking-widest font-bold ${dark ? 'text-white/50 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'} transition-colors`}>
            Registros de Terminal ADB ({logs.length})
          </p>
          {collapsed ? <ChevronUp size={12} className={collapseIconClass} /> : <ChevronDown size={12} className={collapseIconClass} />}
        </button>
        <button
          type="button"
          onClick={onClearLogs}
          title="Limpiar registros"
          className={`text-[10px] transition-colors px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold ${
            dark
              ? 'text-white/40 hover:text-[#22c97d] bg-white/[0.04] hover:bg-white/[0.08]'
              : 'text-slate-500 hover:text-emerald-700 bg-slate-100 hover:bg-slate-200'
          }`}
        >
          <Trash2 size={11} /> Limpiar
        </button>
      </div>

      {!collapsed && (
        <div
          ref={boxRef}
          className={`space-y-1 font-mono text-[11px] min-h-[60px] max-h-[160px] h-28 overflow-y-auto custom-scrollbar rounded-lg p-2.5 mt-2 ${
            dark ? 'bg-black/60 border border-white/5' : 'bg-slate-900 border border-slate-800 text-slate-100'
          }`}
        >
          {logs.length === 0 ? (
            <p className="text-slate-500 italic text-[10px]">Sin registros activos...</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 leading-tight">
                <span className="text-slate-500 shrink-0 text-[10px] select-none">{log.timestamp}</span>
                <span
                  className={`shrink-0 uppercase text-[8px] px-1 py-0.5 rounded font-bold tracking-wider select-none ${getLogBadgeClass(log.type)}`}
                >
                  {log.type}
                </span>
                <span
                  className={`break-all ${getLogMessageClass(log.type)}`}
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
};
