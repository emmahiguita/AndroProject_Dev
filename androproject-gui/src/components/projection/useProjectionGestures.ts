// ============================================================================
// ARCHIVO: useProjectionGestures.ts
// QUÉ HACE: Traduce interacciones del usuario (tap, long-press, swipe, rueda)
//           a comandos táctiles ADB de baja latencia y zoom del visor.
// CÓMO FUNCIONA: Delega geometría pura a `projection-math.ts`, limpia todos
//           los temporizadores y protege `refreshNow` contra llamadas tras desmontar.
// POR QUÉ: Desacoplar la física de gestos del renderizado visual (SRP, < 200L).
// ============================================================================
'use client';
import { apiUrl } from '@/lib/api-url';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildDragSwipePayload, buildWheelSwipePayload, clamp, clamp01,
  mapClientToDeviceCoords, MAX_SCALE, MIN_SCALE,
  type TouchRipple, type ZoomState,
} from './projection-math';

const TAP_MOVE_PX = 10;
const TAP_MAX_MS = 500;
const LONG_PRESS_MS = 600;
const MIN_SWIPE_DEVICE_PX = 8;
const WHEEL_DEBOUNCE_MS = 80;

interface UseProjectionGesturesParams {
  serial: string;
  resolution?: string;
  imgRef: React.RefObject<HTMLImageElement | null>;
  screenRef: React.RefObject<HTMLDivElement | null>;
  zoom: ZoomState;
  setZoom: React.Dispatch<React.SetStateAction<ZoomState>>;
  imgError: boolean;
  shouldRefreshAfterTouch: boolean;
  refreshNow: () => void;
}

export function useProjectionGestures({
  serial, resolution, imgRef, screenRef, zoom, setZoom, imgError, shouldRefreshAfterTouch, refreshNow,
}: UseProjectionGesturesParams) {
  const [ripples, setRipples] = useState<TouchRipple[]>([]);
  const mountedRef = useRef(true);
  const rippleIdRef = useRef(0);
  const rippleTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const wheelLockRef = useRef(0);
  const dragRef = useRef<null | {
    id: number; startX: number; startY: number; startT: number;
    moved: boolean; lastX: number; lastY: number; longPressTimer?: ReturnType<typeof setTimeout>;
  }>(null);

  // Limpia temporizadores y marca desmontaje para evitar actualizaciones zombis
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      rippleTimersRef.current.forEach((t) => clearTimeout(t));
      rippleTimersRef.current.clear();
      if (dragRef.current?.longPressTimer) clearTimeout(dragRef.current.longPressTimer);
      dragRef.current = null;
    };
  }, []);

  const postTouch = useCallback((payload: Record<string, unknown>) => {
    fetch(apiUrl('/api/actions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
      .then(() => { if (mountedRef.current && shouldRefreshAfterTouch) refreshNow(); })
      .catch(() => {});
  }, [refreshNow, shouldRefreshAfterTouch]);

  const toDevice = useCallback((cx: number, cy: number) => {
    const mediaEl = imgRef.current || screenRef.current?.querySelector('canvas') || null;
    return mapClientToDeviceCoords(cx, cy, mediaEl, screenRef.current, resolution, zoom);
  }, [imgRef, screenRef, resolution, zoom]);

  const toDeviceRef = useRef(toDevice);
  toDeviceRef.current = toDevice;
  const postTouchRef = useRef(postTouch);
  postTouchRef.current = postTouch;

  // Rueda del mouse: Ctrl+Rueda hace zoom; Rueda normal hace scroll en el móvil
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const mediaEl = imgRef.current || el.querySelector('canvas');
      if (!mediaEl) return;

      if (e.ctrlKey || e.metaKey) {
        const f = Math.exp(-e.deltaY * 0.002);
        const r = mediaEl.getBoundingClientRect();
        setZoom((z) => ({
          scale: clamp(z.scale * f, MIN_SCALE, MAX_SCALE),
          ox: clamp01((e.clientX - r.left) / Math.max(1, r.width)),
          oy: clamp01((e.clientY - r.top) / Math.max(1, r.height)),
        }));
        return;
      }

      const now = performance.now();
      if (now - wheelLockRef.current < WHEEL_DEBOUNCE_MS) return;
      wheelLockRef.current = now;
      const p = toDeviceRef.current(e.clientX, e.clientY);
      if (p && serial) postTouchRef.current(buildWheelSwipePayload(serial, p, e.deltaX, e.deltaY));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [imgRef, screenRef, serial, setZoom]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || imgError || dragRef.current) return;
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const { clientX, clientY } = e;
    const longPressTimer = setTimeout(() => {
      if (dragRef.current && !dragRef.current.moved && serial) {
        const p = toDeviceRef.current(clientX, clientY);
        if (p) {
          postTouchRef.current({ action: 'input_swipe', x1: p.x, y1: p.y, x2: p.x, y2: p.y, duration: 750, serial });
          dragRef.current.moved = true;
        }
      }
    }, LONG_PRESS_MS);

    dragRef.current = {
      id: e.pointerId, startX: clientX, startY: clientY, startT: performance.now(),
      moved: false, lastX: clientX, lastY: clientY, longPressTimer,
    };

    const sr = screenRef.current?.getBoundingClientRect();
    if (sr) {
      const id = ++rippleIdRef.current;
      setRipples((p) => [...p.slice(-4), { id, x: clientX - sr.left, y: clientY - sr.top }]);
      const t = setTimeout(() => {
        rippleTimersRef.current.delete(t);
        setRipples((p) => p.filter((r) => r.id !== id));
      }, 400);
      rippleTimersRef.current.add(t);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) >= TAP_MOVE_PX) {
      d.moved = true;
      if (d.longPressTimer) { clearTimeout(d.longPressTimer); d.longPressTimer = undefined; }
    }
    if (zoom.scale > 1) {
      const media = imgRef.current || screenRef.current?.querySelector('canvas');
      const r = media?.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) {
        setZoom((z) => ({
          ...z,
          ox: clamp01(z.ox - (e.clientX - d.lastX) / r.width),
          oy: clamp01(z.oy - (e.clientY - d.lastY) / r.height),
        }));
      }
    }
    d.lastX = e.clientX; d.lastY = e.clientY;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.longPressTimer) clearTimeout(d.longPressTimer);
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (!serial) return;

    if (!d.moved && performance.now() - d.startT < TAP_MAX_MS) {
      const p = toDeviceRef.current(d.startX, d.startY);
      if (p) postTouchRef.current({ action: 'input_tap', x: p.x, y: p.y, serial });
    } else if (d.moved && zoom.scale === 1) {
      const a = toDeviceRef.current(d.startX, d.startY);
      const b = toDeviceRef.current(e.clientX, e.clientY);
      const swipe = a && b ? buildDragSwipePayload(serial, a, b, MIN_SWIPE_DEVICE_PX) : null;
      if (swipe) postTouchRef.current(swipe);
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id === e.pointerId) {
      if (dragRef.current.longPressTimer) clearTimeout(dragRef.current.longPressTimer);
      dragRef.current = null;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
  };

  return { ripples, onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
