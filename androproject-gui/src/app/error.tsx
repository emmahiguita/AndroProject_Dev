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
    <div className="min-h-screen bg-[var(--surface-root)] text-text-primary flex items-center justify-center p-8 font-sans">
      <div className="max-w-md w-full bg-surface-card border border-border-default rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-border-default flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={28} className="text-red-500" />
        </div>
        <h1 className="text-lg font-bold tracking-tight text-text-primary mb-1.5">Error del Sistema</h1>
        <p className="text-xs text-text-secondary mb-2">AndroProject encontró un error inesperado.</p>
        {error.digest && (
          <p className="text-xs text-text-tertiary font-mono mb-6">ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hov)] text-[var(--btn-primary-text)] rounded-xl font-semibold text-xs flex items-center gap-2 mx-auto transition-all active:scale-[0.98] shadow-sm"
        >
          <RefreshCw size={15} /> Reintentar
        </button>
        <p className="text-[10px] text-text-tertiary mt-6">
          Si el error persiste, cierra y reabre la aplicación.
        </p>
      </div>
    </div>
  );
}
