'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AndroProject Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8 font-sans">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <h1 className="text-lg font-bold tracking-tight text-zinc-100 mb-1.5">Error del Sistema</h1>
        <p className="text-xs text-zinc-400 mb-2">AndroProject encontró un error inesperado.</p>
        {error.digest && (
          <p className="text-xs text-zinc-500 font-mono mb-6">ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-xl font-semibold text-xs flex items-center gap-2 mx-auto transition-all active:scale-[0.98] shadow-sm"
        >
          <RefreshCw size={15} /> Reintentar
        </button>
        <p className="text-[10px] text-zinc-500 mt-6">
          Si el error persiste, cierra y reabre la aplicación.
        </p>
      </div>
    </div>
  );
}
