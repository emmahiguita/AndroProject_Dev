// ============================================================================
// ARCHIVO: MultiScreenGrid.tsx
// QUÉ HACE: Renderiza una cuadrícula multipantalla fluida para proyectar varios
//           dispositivos Android/iOS en paralelo sin bloqueos entre paneles.
// CÓMO FUNCIONA: Cada dispositivo vive en un subcomponente memorizado
//           (DeviceScreenTile) con estado aislado de zoom y FPS.
// POR QUÉ: Evitar re-renders cruzados al actualizar FPS/zoom en una pantalla.
// ============================================================================
'use client';

import React, { useState, useCallback } from 'react';
import { Smartphone, ExternalLink, MonitorPlay } from 'lucide-react';
import { ProjectionCanvas, ZoomState } from './ProjectionCanvas';
import { useAppStore } from '@/stores';
import type { DeviceInfo } from '@/features/types';

interface MultiScreenGridProps {
  devices: DeviceInfo[];
  onToggleScrcpy?: (serial: string) => void;
  dark?: boolean;
}

interface DeviceScreenTileProps {
  device: DeviceInfo;
  isActive: boolean;
  dark: boolean;
  onToggleScrcpy?: (serial: string) => void;
  onPopout: (serial: string) => void;
}

const DeviceScreenTile = React.memo<DeviceScreenTileProps>(function DeviceScreenTile({
  device,
  isActive,
  dark,
  onToggleScrcpy,
  onPopout,
}) {
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, ox: 0.5, oy: 0.5 });
  const [fps, setFps] = useState<number>(60);
  const serial = device.serial;
  const isIos = device.platform === 'ios' || serial.startsWith('airplay-');

  const handleToggle = useCallback(() => {
    onToggleScrcpy?.(serial);
  }, [onToggleScrcpy, serial]);

  const handlePopout = useCallback(() => {
    onPopout(serial);
  }, [onPopout, serial]);

  return (
    <div
      className={`flex flex-col rounded-xl border overflow-hidden min-h-[360px] ${
        dark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      {/* Tile Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b shrink-0 gap-2 ${
        dark ? 'border-zinc-800 bg-zinc-950' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            isActive ? 'bg-emerald-500' : 'bg-zinc-600'
          }`} />
          <span className={`font-semibold text-xs truncate ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
            {device.model || serial}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0 ${
            dark ? 'bg-zinc-800 border border-zinc-700 text-zinc-300' : 'bg-slate-100 border border-slate-200 text-slate-600'
          }`}>
            {isIos ? 'iOS · 60 FPS' : `${fps} FPS`}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleScrcpy && (
            <button
              type="button"
              onClick={handleToggle}
              aria-label={`Abrir ventana nativa 60 FPS para ${device.model || serial}`}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                dark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="Abrir ventana nativa Direct3D11 (60 FPS)"
            >
              <MonitorPlay size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={handlePopout}
            aria-label={`Desprender pantalla flotante de ${device.model || serial}`}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              dark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900'
            }`}
            title="Desprender a ventana flotante independiente"
          >
            <ExternalLink size={12} />
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="flex-1 min-h-0 relative p-1 bg-black flex items-center justify-center">
        <ProjectionCanvas
          device={device}
          useMjpegStream={!isIos}
          scrcpyActive={isActive}
          onToggleScrcpy={onToggleScrcpy ? handleToggle : undefined}
          zoom={zoom}
          setZoom={setZoom}
          onFpsUpdate={setFps}
          className="w-full h-full"
        />
      </div>
    </div>
  );
});

export const MultiScreenGrid: React.FC<MultiScreenGridProps> = ({
  devices,
  onToggleScrcpy,
  dark = true,
}) => {
  const activeSerial = useAppStore((s) => s.activeSerial);
  const isScreenStreaming = useAppStore((s) => s.isScreenStreaming);

  // Si un mismo modelo físico está conectado por USB y Wi-Fi (IP:5555) a la vez, prioriza USB
  const uniquePhysicalDevices = React.useMemo(() => {
    const usbModels = new Set(
      devices
        .filter((d) => !d.serial.includes(':') && d.model)
        .map((d) => d.model!.trim().toLowerCase()),
    );
    return devices.filter((d) => {
      if (d.serial.includes(':') && d.model && usbModels.has(d.model.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [devices]);

  const openPopout = useCallback((serial: string) => {
    const width = 420;
    const height = 860;
    const left = window.screenX + 50;
    const top = window.screenY + 50;
    window.open(
      `/popout?serial=${encodeURIComponent(serial)}`,
      `popout_${serial.replace(/[^a-zA-Z0-9]/g, '_')}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,status=no`
    );
  }, []);

  if (uniquePhysicalDevices.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full p-8 text-center ${
        dark ? 'text-zinc-500' : 'text-slate-400'
      }`}>
        <Smartphone size={36} className="mb-3 opacity-40" />
        <p className={`text-sm font-semibold ${dark ? 'text-zinc-300' : 'text-slate-700'}`}>
          No hay pantallas conectadas
        </p>
        <p className="text-xs mt-1">
          Conecta uno o más dispositivos Android/iOS para proyectar en paralelo
        </p>
      </div>
    );
  }

  const gridColsClass =
    uniquePhysicalDevices.length === 1
      ? 'grid-cols-1'
      : uniquePhysicalDevices.length === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';

  return (
    <div className={`grid ${gridColsClass} gap-2.5 h-full w-full overflow-y-auto p-2.5 min-h-0`}>
      {uniquePhysicalDevices.map((device) => {
        const isActive = (activeSerial === device.serial && isScreenStreaming) || Boolean(device.connected);
        return (
          <DeviceScreenTile
            key={device.serial}
            device={device}
            isActive={isActive}
            dark={dark}
            onToggleScrcpy={onToggleScrcpy}
            onPopout={openPopout}
          />
        );
      })}
    </div>
  );
};
