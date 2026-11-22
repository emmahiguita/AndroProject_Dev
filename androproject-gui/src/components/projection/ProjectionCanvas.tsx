// ============================================================================
// ARCHIVO: ProjectionCanvas.tsx
// QUÉ HACE: Orquesta el visor interactivo del móvil combinando video GPU
//           WebCodecs H.264 a 60 FPS, fallback snapshot, gestos y Drag & Drop.
// CÓMO FUNCIONA: Delega matemática a `projection-math.ts`, gestos a
//           `useProjectionGestures.ts`, carga de APK/archivos a
//           `useProjectionDrop.ts` y overlays a `ProjectionOverlays.tsx`.
// POR QUÉ: Cumplir SRP y mantener cada módulo < 200 líneas sin código muerto.
// ============================================================================
'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  className?: string;
}

export const ProjectionCanvas: React.FC<ProjectionCanvasProps> = ({
  device,
  useMjpegStream = false,
  zoom,
  setZoom,
  onFpsUpdate,
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

  // Reintento automático silencioso si WebCodecs falla durante cold-start
  useEffect(() => {
    if (!mjpegError || !useMjpegStream) return;
    const t = setTimeout(() => setMjpegError(false), 5000);
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
  const zoomed = zoom.scale > 1;
  const isDisconnected = !connected || device.state !== 'device';
  const showLiveStream = useMjpegStream ? Boolean(device.serial && !mjpegError) : Boolean(frameUrl && !imgError);
  const useWebCodecs = useMjpegStream && Boolean(device.serial) && !mjpegError && !device.serial.startsWith('airplay-');

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
        className={`relative w-full h-full rounded-[24px] overflow-hidden bg-black select-none touch-none shadow-inner flex items-center justify-center ${
          showLiveStream ? (zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair') : 'cursor-default'
        }`}
      >
        {/* Proyección principal GPU WebCodecs H.264 60 FPS + control binario < 2ms */}
        {useWebCodecs && (
          <WebCodecsCanvas
            serial={device.serial}
            onFpsUpdate={onFpsUpdate}
            onReady={() => setMjpegError(false)}
            onError={() => setMjpegError(true)}
          />
        )}

        {/* Fallback por snapshots cuando WebCodecs no aplica (ej. iOS o error temporal) */}
        {(!useMjpegStream || mjpegError) && frameUrl && (
          <img
            ref={!useMjpegStream ? imgRef : undefined}
            src={frameUrl}
            alt={`Pantalla ${device.model}`}
            draggable={false}
            onLoad={() => setImgError(false)}
            onError={() => setImgError(true)}
            className={`w-full h-full object-fill pointer-events-none transition-transform duration-75 ${imgError ? 'hidden' : ''}`}
            style={{ transform: `scale(${zoom.scale})`, transformOrigin: `${zoom.ox * 100}% ${zoom.oy * 100}%` }}
          />
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
