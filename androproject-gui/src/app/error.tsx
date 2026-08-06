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
    <div className="min-h-screen bg-[#0a0c17] text-white flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-[#0f1120] border border-red-500/20 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={32} className="text-red-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">Error del Sistema</h1>
        <p className="text-sm text-white/50 mb-2">AndroProject encontro un error inesperado.</p>
        {error.digest && (
          <p className="text-xs text-white/30 font-mono mb-6">ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold text-sm flex items-center gap-2 mx-auto transition-all active:scale-95 shadow-lg shadow-cyan-500/10"
        >
          <RefreshCw size={16} /> Reintentar
        </button>
        <p className="text-[10px] text-white/20 mt-6">
          Si el error persiste, cierra y reabre la aplicacion.
        </p>
      </div>
    </div>
  );
}
