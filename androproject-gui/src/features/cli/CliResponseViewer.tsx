// ============================================================================
// ARCHIVO: CliResponseViewer.tsx
// QUÉ HACE: Visualizador de terminal y respuestas interactivas con opciones de
//           continuación dinámica, botones de copia y diseño adaptado a landscape/móvil.
// CÓMO FUNCIONA: Muestra la salida del comando/modelo e integra chips de sugerencias
//           contextuales que permiten responder o profundizar con un solo toque.
// POR QUÉ: Elimina respuestas estáticas/robóticas e impulsa la automatización fluida (< 200L).
// ============================================================================
'use client';

import React, { useState } from 'react';
import { Copy, Check, Sparkles, AlertCircle } from 'lucide-react';

interface CliResponseViewerProps {
  output: string;
  error: string | null;
  providerMeta?: string;
  suggestions: string[];
  onSelectSuggestion: (text: string) => void;
  dark: boolean;
}

export const CliResponseViewer: React.FC<CliResponseViewerProps> = ({
  output,
  error,
  providerMeta,
  suggestions,
  onSelectSuggestion,
  dark,
}) => {
  const [copied, setCopied] = useState(false);

  if (!output && !error) return null;

  const cardCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';
  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`rounded-xl border p-4 sm:p-5 space-y-3 ${cardCls} shadow-sm animate-in fade-in duration-200`}>
      {/* Barra superior con metadatos y botón de copia */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${mutedCls}`}>
            Respuesta {providerMeta ? `(${providerMeta})` : ''}
          </span>
        </div>
        {output && (
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              dark
                ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        )}
      </div>

      {/* Mensaje de error o salida del terminal */}
      {error ? (
        <div className={`p-3 rounded-lg border flex items-start gap-2.5 ${
          dark ? 'bg-zinc-900/70 border-zinc-800 text-red-300' : 'bg-slate-50 border-slate-200 text-red-800'
        }`}>
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
          <p className="text-xs font-mono break-words">{error}</p>
        </div>
      ) : (
        <div className={`rounded-lg border p-3.5 max-h-96 overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed ${
          dark ? 'bg-zinc-900/60 border-zinc-800/80 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <pre className="whitespace-pre-wrap break-words">{output}</pre>
        </div>
      )}

      {/* Opciones de respuesta interactivas (Sugerencias dinámicas) */}
      {suggestions.length > 0 && (
        <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} className={dark ? 'text-zinc-400' : 'text-slate-500'} />
            <span className={`text-[11px] font-semibold ${mutedCls}`}>Opciones para responder:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => onSelectSuggestion(sug)}
                className={`text-[11px] text-left px-2.5 py-1 rounded-lg border transition-all ${
                  dark
                    ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-800 hover:border-zinc-700 active:scale-95'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-300 active:scale-95'
                }`}
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
