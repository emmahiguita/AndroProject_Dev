// ============================================================================
// ARCHIVO: DeviceFrameHeader.tsx
// QUÉ HACE: Renderiza la barra superior del visor de dispositivo con estado,
//           toggle de transmisión 60 FPS y botones de ventana (Minimizar,
//           Fullscreen y Popout independiente).
// CÓMO FUNCIONA: Componente presentacional puro que delega las acciones al
//           contenedor `DeviceFrame.tsx`.
// POR QUÉ: Aplicar SRP y mantener `DeviceFrame.tsx` cómodamente bajo 200 líneas.
// ============================================================================
'use client';

import React from 'react';
import { MonitorPlay, Minus, Square, Minimize2, Maximize2, ExternalLink } from 'lucide-react';
import type { DeviceInfo } from '../../features/types';

interface DeviceFrameHeaderProps {
  device: DeviceInfo;
  isIos: boolean;
  scrcpyActive?: boolean;
  onToggleScrcpy?: () => void;
  currentFps: number;
  minimized: boolean;
  isFullscreen: boolean;
  onToggleMinimize: () => void;
  onToggleMaximize: () => void;
  onOpenPopout: () => void;
}

const CTRL_BTN =
  'w-6 h-6 rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer';

export const DeviceFrameHeader: React.FC<DeviceFrameHeaderProps> = ({
  device, isIos, scrcpyActive, onToggleScrcpy, currentFps,
  minimized, isFullscreen, onToggleMinimize, onToggleMaximize, onOpenPopout,
}) => {
  const isDisconnected = device.state !== 'device';

  return (
    <div className="mx-2 mt-1.5 mb-1 px-3 py-1.5 rounded-xl border border-zinc-800/80 bg-zinc-900/70 flex items-center justify-between shrink-0 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-5 h-5 rounded-md border border-zinc-800 bg-zinc-950 flex items-center justify-center shrink-0 overflow-hidden">
          <img src="/logo.png" alt="AndroProject" className="w-full h-full object-cover" />
        </div>
        <span className="font-semibold text-zinc-100 text-xs tracking-tight truncate">
          {device.model || 'Android Device'}
        </span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-800/60 border border-zinc-700/40 text-[10px]">
          <span className={`w-1.5 h-1.5 rounded-full ${isDisconnected ? 'bg-zinc-600' : 'bg-emerald-500'}`} />
          <span className="font-mono text-zinc-300">{device.serial}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onToggleScrcpy && !isIos && (
          <button
            type="button"
            onClick={onToggleScrcpy}
            className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
              scrcpyActive
                ? 'bg-zinc-800 text-emerald-400 border-zinc-700 hover:bg-zinc-700'
                : 'bg-zinc-800/80 text-zinc-200 border-zinc-700/50 hover:bg-zinc-700'
            }`}
          >
            <MonitorPlay size={12} className={scrcpyActive ? 'text-emerald-400' : 'text-zinc-400'} />
            <span className="hidden sm:inline">
              {scrcpyActive ? `${currentFps || 60} FPS Activo` : 'Transmitir 60 FPS'}
            </span>
          </button>
        )}

        <div className="flex items-center gap-1 pl-1 border-l border-zinc-800/80">
          <button type="button" onClick={onToggleMinimize} className={CTRL_BTN} title={minimized ? 'Restaurar visor' : 'Minimizar visor'}>
            {minimized ? <Maximize2 size={11} /> : <Minus size={12} />}
          </button>
          <button type="button" onClick={onToggleMaximize} className={CTRL_BTN} title={isFullscreen ? 'Salir de pantalla completa' : 'Maximizar a pantalla completa'}>
            {isFullscreen ? <Minimize2 size={11} /> : <Square size={10} />}
          </button>
          <button type="button" onClick={onOpenPopout} className={CTRL_BTN} title="Abrir en ventana flotante independiente">
            <ExternalLink size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};
