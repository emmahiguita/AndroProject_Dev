// ============================================================================
// ARCHIVO: MobileProjection.tsx
// QUÉ HACE: Renderiza la vista de proyección adaptada a pantallas móviles/compactas.
// CÓMO FUNCIONA: Conecta el estado real de grabación (`isRecording`, `toggleRecord`)
//           y transmisión 60 FPS (`scrcpyActive`, `toggleScrcpy`) a `DeviceFrame`.
// POR QUÉ: Garantizar que todos los botones de `DeviceFrameHeader` tengan lógica
//          activa también en viewports compactos (< 200 líneas, SRP).
// ============================================================================
'use client';

import { Maximize, Minimize, Circle, Square } from 'lucide-react';
import { DeviceFrame } from '@/components/layout/DeviceFrame';
import type { DeviceInfo } from '@/features/types';
import type { useProjection } from '@/hooks/useProjection';

interface MobileProjectionProps {
  device: DeviceInfo;
  dark: boolean;
  projection: ReturnType<typeof useProjection>;
}

export function MobileProjection({ device, dark, projection }: MobileProjectionProps) {
  const isIos = device.platform === 'ios' || device.serial?.startsWith('airplay-');

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={`flex items-center justify-between shrink-0 px-3 py-2 border-b ${
        dark ? 'border-zinc-800 bg-zinc-900/60' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${projection.scrcpyActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'}`} />
          <span className={`text-[11px] font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{device.model}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {!isIos && (
            <button
              type="button"
              onClick={projection.toggleRecord}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                projection.isRecording
                  ? 'bg-rose-950/70 border-rose-700 text-rose-300 animate-pulse'
                  : dark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              {projection.isRecording ? <Square size={10} fill="currentColor" /> : <Circle size={10} fill="currentColor" className="text-rose-400" />}
              <span>{projection.isRecording ? 'REC' : 'Grabar'}</span>
            </button>
          )}
          <button
            type="button"
            aria-label={projection.fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            onClick={projection.toggleFullscreen}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              dark ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {projection.fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>
      </div>

      {/* Contenedor flexible con overflow-hidden para adaptarse sin recortes en modo horizontal */}
      <div className="flex-1 flex items-center justify-center bg-black min-h-0 min-w-0 overflow-hidden">
        <DeviceFrame
          device={device}
          expanded={true}
          compact={true}
          onSendKey={projection.sendKey}
          scrcpyActive={projection.scrcpyActive}
          onToggleScrcpy={projection.toggleScrcpy}
          isRecording={projection.isRecording}
          recordingSeconds={projection.recordingSeconds}
          onToggleRecord={projection.toggleRecord}
        />
      </div>
    </div>
  );
}
