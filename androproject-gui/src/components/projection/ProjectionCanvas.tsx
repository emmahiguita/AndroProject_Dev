// ============================================================================
// ARCHIVO: ProjectionCanvas.tsx
// QUÉ HACE: Orquesta el visor interactivo del móvil combinando video GPU
//           WebCodecs H.264 a 60 FPS, fallback snapshot, gestos, zoom/paneo,
//           clic derecho (Atrás) y Drag & Drop de APKs/archivos.
// CÓMO FUNCIONA: Delega matemática a `projection-math.ts`, gestos a
//           `useProjectionGestures.ts`, carga de APK/archivos a
//           `useProjectionDrop.ts` y overlays a `ProjectionOverlays.tsx`.
// POR QUÉ: Cumplir SRP y mantener cada módulo < 200 líneas sin código muerto.
// ============================================================================
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { apiUrl } from '@/lib/api-url';
import { useDeviceStream } from '@/hooks/useDeviceStream';
import { WebCodecsCanvas } from './WebCodecsCanvas';
import { ProjectionOverlays } from './ProjectionOverlays';
import { useProjectionGestures } from './useProjectionGestures';
import { useProjectionDrop } from './useProjectionDrop';
import type { ZoomState, TouchRipple } from './projection-math';
import type { DeviceInfo } from '@/features/types';

export type { ZoomState, TouchRipple };

interface ProjectionCanvasProps {
  device: DeviceInfo;
  useMjpegStream?: boolean;
  scrcpyActive?: boolean;
  onToggleScrcpy?: () => void;
  zoom: ZoomState;
  setZoom: React.Dispatch<React.SetStateAction<ZoomState>>;
  onFpsUpdate?: (fps: number) => void;
  onVideoResize?: (width: number, height: number) => void;
  className?: string;
}

export const ProjectionCanvas: React.FC<ProjectionCanvasProps> = ({
  device,
  useMjpegStream = false,
  zoom,
  setZoom,
  onFpsUpdate,
  onVideoResize,
  className = '',
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  const [mjpegError, setMjpegError] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isPollingEnabled = !useMjpegStream || mjpegError;
  const { frameUrl, connected: pollingConnected, fps, refreshNow } = useDeviceStream(device.serial, isPollingEnabled);
  const connected = useMjpegStream ? device.state === 'device' : pollingConnected;

  useEffect(() => {
    if (isPollingEnabled) onFpsUpdate?.(fps);
  }, [fps, isPollingEnabled, onFpsUpdate]);

  useEffect(() => { setImgError(false); }, [frameUrl]);
  useEffect(() => { setImgError(false); setMjpegError(false); }, [device?.serial]);

  // Reintento automático espaciado si WebCodecs falla durante cold-start (evita parpadeos)
  useEffect(() => {
    if (!mjpegError || !useMjpegStream) return;
    const t = setTimeout(() => setMjpegError(false), 15000);
    return () => clearTimeout(t);
  }, [mjpegError, useMjpegStream]);

  const gestures = useProjectionGestures({
    serial: device.serial,
    resolution: device.resolution,
    imgRef,
    screenRef,
    zoom,
    setZoom,
    imgError,
    shouldRefreshAfterTouch: isPollingEnabled,
    refreshNow,
  });

  const drop = useProjectionDrop(device.serial);
  const zoomed = zoom.scale > 1.01;
  const isDisconnected = !connected || device.state !== 'device';
  const showLiveStream = useMjpegStream ? Boolean(device.serial && !mjpegError) : Boolean(frameUrl && !imgError);
  const isIos = device.platform === 'ios' || device.serial.startsWith('airplay-') || device.serial.startsWith('apple-');
  const useWebCodecs = useMjpegStream && Boolean(device.serial) && !mjpegError && !isIos;

  /** Clic derecho sobre la pantalla envía KEYCODE_BACK (como en scrcpy nativo). */
  const handleContextBack = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!device.serial) return;
    fetch(apiUrl('/api/actions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'keyevent', keycode: 'KEYCODE_BACK', serial: device.serial }),
      keepalive: true,
    }).catch(() => {});
  };

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}
      onDragOver={drop.handleDragOver}
      onDragLeave={drop.handleDragLeave}
      onDrop={drop.handleDrop}
    >
      <div
        ref={screenRef}
        onPointerDown={gestures.onPointerDown}
        onPointerMove={gestures.onPointerMove}
        onPointerUp={gestures.onPointerUp}
        onPointerCancel={gestures.onPointerCancel}
        onContextMenu={handleContextBack}
        className={`relative w-full h-full rounded-[24px] overflow-hidden bg-black select-none touch-none shadow-inner flex items-center justify-center ${
          showLiveStream ? (zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair') : 'cursor-default'
        }`}
      >
        {useWebCodecs && (
          <WebCodecsCanvas
            serial={device.serial}
            zoom={zoom}
            onFpsUpdate={onFpsUpdate}
            onResize={onVideoResize}
            onReady={() => setMjpegError(false)}
            onError={() => setMjpegError(true)}
          />
        )}

        {(!useMjpegStream || mjpegError) && frameUrl && (
          <img
            ref={!useMjpegStream ? imgRef : undefined}
            src={frameUrl}
            alt={`Pantalla ${device.model}`}
            draggable={false}
            onLoad={(e) => {
              setImgError(false);
              const im = e.currentTarget;
              if (im.naturalWidth && im.naturalHeight) onVideoResize?.(im.naturalWidth, im.naturalHeight);
            }}
            onError={() => setImgError(true)}
            className={`w-full h-full object-fill pointer-events-none transition-transform duration-75 ${imgError ? 'hidden' : ''}`}
            style={{ transform: `scale(${zoom.scale})`, transformOrigin: `${zoom.ox * 100}% ${zoom.oy * 100}%` }}
          />
        )}

        {zoomed && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoom({ scale: 1, ox: 0.5, oy: 0.5 }); }}
            className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1 px-2 py-1 rounded-md border border-zinc-700 bg-zinc-900/90 text-[10px] font-mono font-semibold text-zinc-100 hover:bg-zinc-800 cursor-pointer"
            title="Restablecer zoom a 1x"
          >
            <RotateCcw size={10} /> <span>{zoom.scale.toFixed(1)}x</span>
          </button>
        )}

        <ProjectionOverlays
          ripples={gestures.ripples}
          showConnecting={!frameUrl && !useMjpegStream && !isDisconnected}
          showDisconnected={!showLiveStream && isDisconnected}
          deviceModel={device.model || 'dispositivo'}
          isDragOver={drop.isDragOver}
          dropStatus={drop.dropStatus}
        />
      </div>
    </div>
  );
};
