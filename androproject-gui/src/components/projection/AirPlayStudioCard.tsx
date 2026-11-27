// ============================================================================
// ARCHIVO: AirPlayStudioCard.tsx
// QUÉ HACE: Conecta controles iOS al receptor y muestra sus errores.
// ============================================================================

'use client';
import { Airplay, Power } from 'lucide-react';
import { useAirPlayServer } from '@/hooks/useAirPlayServer';

// Muestra los controles que admite el receptor instalado.
export function AirPlayStudioCard({ dark, cardStyle }: { dark: boolean; cardStyle: string }) {
  const { status: airplayStatus, loading: airplayLoading, error: airplayError, toggleServer } = useAirPlayServer();

  return (
    <div className={`rounded-xl border p-3.5 ${cardStyle} space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${dark ? 'bg-zinc-800 text-zinc-200' : 'bg-slate-200 text-slate-800'}`}>
            <Airplay size={14} />
          </div>
          <div>
            <h3 className={`text-xs font-semibold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
              Receptor Apple AirPlay 2
            </h3>
            <p className={`text-[10px] ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Estado del proceso receptor</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${dark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-slate-100 border-slate-300 text-slate-800'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" /> iOS
        </span>
      </div>

      {airplayError && <p role="alert" className="text-xs text-red-500">{airplayError}</p>}
      <div className={`p-2.5 rounded-lg border space-y-2 ${dark ? 'bg-zinc-950/60 border-zinc-800/80' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center justify-between text-[11px]">
          <span className={dark ? 'text-zinc-400 font-normal' : 'text-slate-600 font-normal'}>Nombre en Red:</span>
          <span className={`font-medium font-mono ${dark ? 'text-zinc-200' : 'text-slate-900'}`}>{airplayStatus.serverName} (:{airplayStatus.port})</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className={dark ? 'text-zinc-400 font-normal' : 'text-slate-600 font-normal'}>Estado Receptor:</span>
          <span className={`font-medium font-mono ${airplayStatus.running ? (dark ? 'text-emerald-400' : 'text-emerald-700') : (dark ? 'text-amber-400' : 'text-amber-700')}`}>
            {airplayStatus.running ? 'Proceso activo · Bonjour sin comprobar' : 'En espera'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={airplayLoading}
          onClick={async () => {
            await toggleServer();
          }}
          className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
            dark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
          }`}
        >
          <Power size={12} className={airplayStatus.running ? (dark ? 'text-emerald-400' : 'text-emerald-600') : (dark ? 'text-zinc-400' : 'text-slate-600')} />
          <span>{airplayStatus.running ? 'Detener' : 'Iniciar'}</span>
        </button>

        <a href="/ios-mirror" className="rounded-lg border border-border-control px-3 py-2 text-center text-xs font-medium">
          Abrir panel iOS
        </a>
      </div>
    </div>
  );
};
