'use client';
import { useState, type ReactNode } from 'react';
import { Copy, Check, ChevronRight } from 'lucide-react';

/** Fila compacta de ruta o puerto con insignia de verificación y botón de copia. */
export function ConfigRow({ icon, label, value, dark, ok }: { icon: ReactNode; label: string; value: string; dark: boolean; ok?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded border ${dark ? 'bg-zinc-900/50 border-zinc-800/80' : 'bg-slate-50 border-slate-200'}`}>
      <span className={`shrink-0 ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-semibold ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>{label}</span>
          {ok !== undefined && (
            <span className={`text-[10px] font-mono px-1.5 rounded border ${dark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-slate-100 border-slate-300 text-slate-800'}`}>{ok ? 'OK' : 'WARN'}</span>
          )}
        </div>
        <p className={`text-[11px] font-mono truncate ${dark ? 'text-zinc-400' : 'text-slate-600'}`} title={value}>{value}</p>
      </div>
      <button
        type="button"
        onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); } }}
        className={`p-1 rounded transition-colors ${dark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-slate-200 text-slate-700'}`}
        title="Copiar valor"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

export function QuickNavBtn({ dark, icon, label, onClick }: { dark: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded border text-[11px] font-semibold transition-colors ${
        dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
      }`}
    >
      <span className="flex items-center gap-1.5 truncate">{icon} <span className="truncate">{label}</span></span>
      <ChevronRight size={12} className="shrink-0 opacity-60" />
    </button>
  );
}
