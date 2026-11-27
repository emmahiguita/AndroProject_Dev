// ============================================================================
// ARCHIVO: WebCodecsCanvas.tsx
// QUÉ HACE: Renderiza el <canvas> GPU H.264 60 FPS, aplica zoom visual,
//           emite cambios de orientación/resolución y despacha toques binarios
//           compensando letterbox y zoom con fallback automático a ADB.
// CÓMO FUNCIONA: Mantiene callbacks en useRef para no reiniciar VideoDecoder
//           en re-renders, libera pointerCapture al soltar y permite que el
//           contenedor padre dibuje ripples y panee cuando `zoom.scale > 1`.
// POR QUÉ: Lograr que la pantalla proyectada sea 100% manejable en vertical,
//          horizontal y con zoom sin perder coordenadas ni eventos (< 150L).
// ============================================================================
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { apiUrl } from '@/lib/api-url';
import { startWebCodecsH264Player } from '@/lib/services/webcodecs-h264-player';
import { clamp01, type ZoomState } from './projection-math';

interface WebCodecsCanvasProps {
  serial: string;
  zoom?: ZoomState;
  className?: string;
  onFpsUpdate?: (fps: number) => void;
  onResize?: (width: number, height: number) => void;
  onError?: () => void;
  onReady?: () => void;
}

/** Envía evento táctil binario (<2ms) a scrcpy-control; si falla en TAP, usa ADB fallback. */
async function sendTouchEvent(
  serial: string,
  action: 0 | 1 | 2,
  nx: number,
  ny: number,
  canvasSize?: { w: number; h: number },
): Promise<void> {
  try {
    const res = await fetch(apiUrl('/api/scrcpy-control'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial, action, nx, ny }),
      keepalive: true,
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.success) return;
    }
  } catch { /* Fallback ADB abajo */ }

  if (action === 0 && canvasSize && canvasSize.w > 0 && canvasSize.h > 0) {
    fetch(apiUrl('/api/actions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'input_tap',
        serial,
        x: Math.round(nx * canvasSize.w),
        y: Math.round(ny * canvasSize.h),
      }),
      keepalive: true,
    }).catch(() => {});
  }
}

export const WebCodecsCanvas: React.FC<WebCodecsCanvasProps> = ({
  serial,
  zoom = { scale: 1, ox: 0.5, oy: 0.5 },
  className = '',
  onFpsUpdate,
  onResize,
  onError,
  onReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasFrame, setHasFrame] = useState(false);
  const pointerDownRef = useRef(false);
  const lastMoveTsRef = useRef(0);

  // Callbacks en ref: evita desmontar/reiniciar VideoDecoder en re-renders del padre
  const cbRef = useRef({ onFpsUpdate, onResize, onError, onReady });
  cbRef.current = { onFpsUpdate, onResize, onError, onReady };

  useEffect(() => {
    setHasFrame(false);
    return startWebCodecsH264Player(serial, () => canvasRef.current, () => ({
      onFrameRendered: () => { setHasFrame(true); cbRef.current.onReady?.(); },
      onFps: (fps) => cbRef.current.onFpsUpdate?.(fps),
      onResize: (w, h) => cbRef.current.onResize?.(w, h),
      onError: () => cbRef.current.onError?.(),
    }));
  }, [serial]);

  /** Convierte posición del puntero en coordenadas normalizadas [0..1] compensando letterbox y zoom. */
  const getNormPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const aspect = (canvas.width || 9) / (canvas.height || 20);
    const boxAspect = rect.width / rect.height;
    const rw = boxAspect > aspect ? rect.height * aspect : rect.width;
    const rh = boxAspect > aspect ? rect.height : rect.width / aspect;
    const ox = (rect.width - rw) / 2;
    const oy = (rect.height - rh) / 2;
    return {
      nx: clamp01((e.clientX - (rect.left + ox)) / rw),
      ny: clamp01((e.clientY - (rect.top + oy)) / rh),
      w: canvas.width || 1080,
      h: canvas.height || 2400,
    };
  };

  const isZoomed = zoom.scale > 1.01;

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={(e) => {
        if (e.button !== 0 || isZoomed) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pointerDownRef.current = true;
        const pos = getNormPos(e);
        if (pos) void sendTouchEvent(serial, 0, pos.nx, pos.ny, { w: pos.w, h: pos.h });
      }}
      onPointerMove={(e) => {
        if (!pointerDownRef.current || isZoomed) return;
        e.stopPropagation();
        const now = performance.now();
        if (now - lastMoveTsRef.current < 16) return;
        lastMoveTsRef.current = now;
        const pos = getNormPos(e);
        if (pos) void sendTouchEvent(serial, 2, pos.nx, pos.ny);
      }}
      onPointerUp={(e) => {
        if (!pointerDownRef.current) return;
        e.stopPropagation();
        pointerDownRef.current = false;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        const pos = getNormPos(e);
        if (pos) void sendTouchEvent(serial, 1, pos.nx, pos.ny);
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        pointerDownRef.current = false;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      }}
      className={`${className} w-full h-full object-contain touch-none select-none transition-transform duration-75 ${
        isZoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      }`}
      style={{
        opacity: hasFrame ? 1 : 0,
        transition: 'opacity 120ms ease-out',
        transform: `scale(${zoom.scale})`,
        transformOrigin: `${zoom.ox * 100}% ${zoom.oy * 100}%`,
      }}
    />
  );
};
