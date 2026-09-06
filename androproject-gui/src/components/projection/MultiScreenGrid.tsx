'use client';

import React, { useState } from 'react';
import { MonitorPlay, Smartphone, Maximize2, ExternalLink, RefreshCw, X, Sliders } from 'lucide-react';
import { ProjectionCanvas, ZoomState } from './ProjectionCanvas';
import type { DeviceInfo } from '@/features/types';

interface MultiScreenGridProps {
  devices: DeviceInfo[];
  onToggleScrcpy?: (serial: string) => void;
  dark?: boolean;
}

export const MultiScreenGrid: React.FC<MultiScreenGridProps> = ({
  devices,
  onToggleScrcpy,
  dark = true,
}) => {
  const [zooms, setZooms] = useState<Record<string, ZoomState>>({});
  const [fpsMap, setFpsMap] = useState<Record<string, number>>({});

  const getZoom = (serial: string): ZoomState => {
    return zooms[serial] || { scale: 1, ox: 0, oy: 0 };
  };

  const setZoom = (serial: string, updater: React.SetStateAction<ZoomState>) => {
    setZooms((prev) => {
      const current = prev[serial] || { scale: 1, ox: 0, oy: 0 };
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [serial]: next };
    });
  };

  const openPopout = (serial: string) => {
    const width = 420;
    const height = 860;
    const left = window.screenX + 50;
    const top = window.screenY + 50;
    window.open(
      `/popout?serial=${encodeURIComponent(serial)}`,
      `popout_${serial.replace(/[^a-zA-Z0-9]/g, '_')}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,status=no`
    );
  };

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-white/40">
        <Smartphone size={36} className="mb-3 opacity-30 animate-pulse" />
        <p className="text-sm font-semibold">No hay pantallas conectadas</p>
        <p className="text-xs text-white/20 mt-1">Conecta uno o más dispositivos Android/iOS para proyectar en paralelo</p>
      </div>
    );
  }

  const gridColsClass = devices.length === 1 
    ? 'grid-cols-1' 
    : devices.length === 2 
      ? 'grid-cols-1 md:grid-cols-2' 
      : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';

  return (
    <div className={`grid ${gridColsClass} gap-3 h-full w-full overflow-y-auto p-2 min-h-0`}>
      {devices.map((device) => {
        const serial = device.serial;
        const currentZoom = getZoom(serial);
        const fps = fpsMap[serial] || 60;

        return (
          <div
            key={serial}
            className={`flex flex-col rounded-2xl border overflow-hidden transition-all shadow-xl min-h-[360px] ${
              dark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white border-slate-200'
            }`}
          >
            {/* Tile Header */}
            <div className={`flex items-center justify-between px-3 py-2 border-b shrink-0 ${
              dark ? 'border-zinc-800 bg-zinc-950/60' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className={`font-semibold text-xs truncate ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
                  {device.model || serial}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0 ${
                  dark ? 'bg-zinc-800 border border-zinc-700 text-zinc-300' : 'bg-slate-100 border border-slate-200 text-slate-600'
                }`}>
                  {fps} FPS
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openPopout(serial)}
                  className={`p-1 rounded-lg transition-all ${
                    dark ? 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                  title="Desprender a ventana flotante independiente"
                >
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>

            {/* Canvas Viewport */}
            <div className="flex-1 min-h-0 relative p-1 bg-black/80 flex items-center justify-center">
              <ProjectionCanvas
                device={device}
                useMjpegStream={false}
                scrcpyActive={true}
                onToggleScrcpy={onToggleScrcpy ? () => onToggleScrcpy(serial) : undefined}
                zoom={currentZoom}
                setZoom={(updater) => setZoom(serial, updater)}
                onFpsUpdate={(newFps) => setFpsMap((prev) => ({ ...prev, [serial]: newFps }))}
                className="w-full h-full"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
