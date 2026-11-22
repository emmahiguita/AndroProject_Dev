// ============================================================================
// ARCHIVO: ProjectionOverlays.tsx
// QUÉ HACE: Renderiza las capas visuales superpuestas del visor de proyección
//           (ondas táctiles, estado conectando/desconectado, drag & drop y toast).
// CÓMO FUNCIONA: Componente presentacional puro sin estado interno ni efectos.
// POR QUÉ: Mantener ProjectionCanvas.tsx limpio y enfocado en orquestación (SRP).
// ============================================================================
'use client';

import React from 'react';
import { Smartphone, Loader2, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import type { TouchRipple } from './projection-math';
import type { DropStatus } from './useProjectionDrop';

interface ProjectionOverlaysProps {
  ripples: TouchRipple[];
  showConnecting: boolean;
  showDisconnected: boolean;
  deviceModel: string;
  isDragOver: boolean;
  dropStatus: DropStatus | null;
}

export const ProjectionOverlays: React.FC<ProjectionOverlaysProps> = ({
  ripples,
  showConnecting,
  showDisconnected,
  deviceModel,
  isDragOver,
  dropStatus,
}) => (
  <>
    {/* Ondas visuales al tocar la pantalla */}
    {ripples.map((r) => (
      <span
        key={r.id}
        className="absolute rounded-full bg-white/30 pointer-events-none animate-ping"
        style={{ left: r.x - 12, top: r.y - 12, width: 24, height: 24 }}
      />
    ))}

    {/* Estado: esperando primer frame */}
    {showConnecting && (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center w-full h-full bg-zinc-950/90 backdrop-blur-sm z-30">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-zinc-300 animate-spin" />
        <div>
          <span className="text-xs font-semibold text-zinc-200 block">Conectando pantalla...</span>
          <span className="text-[11px] text-zinc-500">Sincronizando con {deviceModel || 'dispositivo'}</span>
        </div>
      </div>
    )}

    {/* Estado: dispositivo desconectado */}
    {showDisconnected && (
      <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
        <Smartphone size={32} className="text-zinc-600" />
        <div>
          <span className="text-xs font-semibold text-zinc-300 block">Dispositivo no disponible</span>
          <span className="text-[11px] text-zinc-500">Conecta tu dispositivo vía USB o Wi-Fi ADB</span>
        </div>
      </div>
    )}

    {/* Overlay al arrastrar APK o archivo sobre el visor */}
    {isDragOver && (
      <div className="absolute inset-0 bg-zinc-950/90 border-2 border-dashed border-zinc-500 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-50 animate-in fade-in duration-150">
        <UploadCloud size={32} className="text-zinc-200 animate-bounce" />
        <span className="text-xs font-semibold text-zinc-100">Soltar archivo para enviar</span>
        <span className="text-[11px] text-zinc-400">Los APK se instalan automáticamente</span>
      </div>
    )}

    {/* Toast de progreso/resultado de carga */}
    {dropStatus && (
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-lg backdrop-blur-md border shadow-lg flex items-center gap-2 z-40 animate-in fade-in slide-in-from-top-2 duration-150 ${
        dropStatus.status === 'uploading' ? 'bg-zinc-900/95 border-zinc-700 text-zinc-200'
        : dropStatus.status === 'success' ? 'bg-zinc-900/95 border-zinc-700 text-emerald-400'
        : 'bg-zinc-900/95 border-zinc-700 text-red-400'
      }`}>
        {dropStatus.status === 'uploading' && <Loader2 size={13} className="animate-spin text-zinc-400" />}
        {dropStatus.status === 'success' && <CheckCircle2 size={13} />}
        {dropStatus.status === 'error' && <AlertCircle size={13} />}
        <span className="text-xs font-medium">{dropStatus.message}</span>
      </div>
    )}
  </>
);
