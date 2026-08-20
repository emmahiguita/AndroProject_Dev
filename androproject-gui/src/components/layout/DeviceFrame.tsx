'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone, ZoomIn, ZoomOut, RotateCcw, RefreshCw, Wifi, Usb } from 'lucide-react';
import { useDeviceStream } from '@/hooks/useDeviceStream';
import { useActions } from '@/hooks/useActions';
import type { DeviceInfo } from '../../features/types';

interface DeviceFrameProps {
  device: DeviceInfo;
  expanded: boolean;
  compact?: boolean;
  onSendKey?: (keycode: string) => void;
}

interface ZoomState {
  scale: number;
  ox: number;
  oy: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const TAP_MOVE_PX = 10;
const TAP_MAX_MS = 500;
const MIN_SWIPE_DEVICE_PX = 8;
const WHEEL_DEBOUNCE_MS = 80;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

/**
 * DeviceFrame — Real-time device screen with streaming + interaction.
 *
 * Streaming:
 *   ADB screencap polling via /api/device-image (~6fps)
 *   Always works on any device, no scrcpy dependency for display.
 *
 * States:
 *   connected + streaming = show live screen
 *   connected + no stream = show connecting
 *   disconnected = show reconnect UI
 *   error = show retry UI
 */
export const DeviceFrame: React.FC<DeviceFrameProps> = ({ device, expanded, compact, onSendKey }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const { frameUrl, error, fps, connected, mode } = useDeviceStream(device.serial, expanded);
  const { run } = useActions();

  // Touch gestures must target THIS device's serial, not the store's activeSerial.
  const tapDevice = useCallback(async (x: number, y: number) => {
    await run('input_tap', 'Tap', { x, y, serial: device.serial }, false);
  }, [run, device.serial]);

  const swipeDevice = useCallback(async (
    x1: number, y1: number, x2: number, y2: number, duration: number = 120,
  ) => {
    await run('input_swipe', 'Gesto', { x1, y1, x2, y2, duration, serial: device.serial }, false);
  }, [run, device.serial]);

  const tapRef = useRef(tapDevice);
  const swipeRef = useRef(swipeDevice);
  useEffect(() => {
    tapRef.current = tapDevice;
    swipeRef.current = swipeDevice;
  });

  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, ox: 0.5, oy: 0.5 });
  const [retryCount, setRetryCount] = useState(0);
  const dragRef = useRef<null | {
    id: number;
    startX: number; startY: number; startT: number;
    moved: boolean;
    lastX: number; lastY: number;
  }>(null);
  const wheelLockRef = useRef(0);

  const toDevice = useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    const rect = img.getBoundingClientRect();
    const s = zoom.scale;
    const w0 = img.clientWidth || rect.width / s;
    const h0 = img.clientHeight || rect.height / s;
    const left0 = rect.left + zoom.ox * rect.width - zoom.ox * w0 * s;
    const top0 = rect.top + zoom.oy * rect.height - zoom.oy * h0 * s;
    const nx = (clientX - left0) / w0;
    const ny = (clientY - top0) / h0;
    if (nx < 0 || ny < 0 || nx > 1 || ny > 1) return null;
    return {
      x: clamp(Math.round(nx * img.naturalWidth), 0, img.naturalWidth - 1),
      y: clamp(Math.round(ny * img.naturalHeight), 0, img.naturalHeight - 1),
    };
  }, [zoom]);

  const zoomBy = useCallback((factor: number) => {
    setZoom((z) => ({ ...z, scale: clamp(z.scale * factor, MIN_SCALE, MAX_SCALE) }));
  }, []);

  // ── Wake screen command ──
  const wakeScreen = useCallback(async () => {
    if (!device.serial) return;
    // Power button to wake screen
    await run('keyevent', 'Despertando pantalla', { keycode: 'KEYCODE_WAKEUP' }, false);
    // Small delay then check
    setTimeout(() => setRetryCount(c => c + 1), 500);
  }, [device.serial, run]);

  // ── Retry connection ──
  const retryConnection = useCallback(() => {
    setRetryCount(c => c + 1);
  }, []);

  const toDeviceRef = useRef(toDevice);
  const frameUrlRef = useRef(frameUrl);
  const errorRef = useRef(error);

  useEffect(() => {
    toDeviceRef.current = toDevice;
    frameUrlRef.current = frameUrl;
    errorRef.current = error;
  });

  // ── Mouse wheel for scrolling/zooming ──
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!frameUrlRef.current || errorRef.current) return;
      e.preventDefault();
      const imgNow = imgRef.current;
      if (!imgNow || !imgNow.naturalWidth) return;

      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.002);
        setZoom((z) => {
          const rect = imgNow.getBoundingClientRect();
          return {
            scale: clamp(z.scale * factor, MIN_SCALE, MAX_SCALE),
            ox: clamp01((e.clientX - rect.left) / rect.width),
            oy: clamp01((e.clientY - rect.top) / rect.height),
          };
        });
        return;
      }

      const now = performance.now();
      if (now - wheelLockRef.current < WHEEL_DEBOUNCE_MS) return;
      wheelLockRef.current = now;

      const p = toDeviceRef.current(e.clientX, e.clientY);
      if (!p) return;
      const nw = imgNow.naturalWidth;
      const nh = imgNow.naturalHeight;
      const steps = clamp(Math.round(Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY)) / 60), 1, 6);
      const amount = 90 * steps;
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        const dir = e.deltaY > 0 ? 1 : -1;
        swipeRef.current(p.x, clamp(p.y + dir * amount, 0, nh), p.x, clamp(p.y - dir * amount, 0, nh), 160);
      } else {
        const dir = e.deltaX > 0 ? 1 : -1;
        swipeRef.current(clamp(p.x - dir * amount, 0, nw), p.y, clamp(p.x + dir * amount, 0, nw), p.y, 160);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Keyboard handler for hardware keys ──
  useEffect(() => {
    if (!expanded || !onSendKey) return;
    const el = screenRef.current;
    if (!el) return;

    // Make the screen container focusable so keydown events reach it.
    el.setAttribute('tabindex', '0');
    el.focus();

    const KEYMAP: Record<string, string> = {
      'ArrowUp': 'KEYCODE_DPAD_UP',
      'ArrowDown': 'KEYCODE_DPAD_DOWN',
      'ArrowLeft': 'KEYCODE_DPAD_LEFT',
      'ArrowRight': 'KEYCODE_DPAD_RIGHT',
      'Enter': 'KEYCODE_DPAD_CENTER',
      'Escape': 'KEYCODE_BACK',
      'Backspace': 'KEYCODE_DEL',
      ' ': 'KEYCODE_SPACE',
      'Home': 'KEYCODE_HOME',
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const keycode = KEYMAP[e.key];
      if (keycode) {
        e.preventDefault();
        onSendKey(keycode);
      }
    };

    const onMouseDown = () => el.focus();

    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('mousedown', onMouseDown);
    return () => {
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('mousedown', onMouseDown);
    };
  }, [expanded, onSendKey]);

  if (!expanded) return null;

  // ── Pointer interaction handlers ──
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !frameUrl || dragRef.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      id: e.pointerId,
      startX: e.clientX, startY: e.clientY, startT: performance.now(),
      moved: false,
      lastX: e.clientX, lastY: e.clientY,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) >= TAP_MOVE_PX) {
      d.moved = true;
    }
    if (zoom.scale > 1) {
      const img = imgRef.current;
      if (img) {
        const rect = img.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setZoom((z) => ({
            ...z,
            ox: clamp01(z.ox - (e.clientX - d.lastX) / rect.width),
            oy: clamp01(z.oy - (e.clientY - d.lastY) / rect.height),
          }));
        }
      }
    }
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    if (!d.moved && performance.now() - d.startT < TAP_MAX_MS) {
      const p = toDevice(d.startX, d.startY);
      if (p) tapRef.current(p.x, p.y);
    } else if (d.moved && zoom.scale === 1) {
      const a = toDevice(d.startX, d.startY);
      const b = toDevice(e.clientX, e.clientY);
      if (a && b && Math.hypot(b.x - a.x, b.y - a.y) >= MIN_SWIPE_DEVICE_PX) {
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        swipeRef.current(a.x, a.y, b.x, b.y, clamp(Math.round(dist * 1.2), 60, 600));
      }
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id === e.pointerId) dragRef.current = null;
  };

  const zoomed = zoom.scale > 1;
  const zoomLabel = `${Math.round(zoom.scale * 100)}%`;
  const isWifi = device.connectionType === 'Wi-Fi';
  const isDisconnected = !connected || device.state !== 'device';

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      {/* Device info bar */}
      <div className={`flex items-center justify-between px-2.5 py-1.5 border-b border-white/5 shrink-0 ${compact ? 'px-2 py-1' : ''}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            isDisconnected ? 'bg-red-500' :
            error ? 'bg-yellow-400' :
            'bg-[#22c97d]'
          } ${!isDisconnected && !error ? 'animate-pulse' : ''}`} />
          <span className="font-bold truncate text-white text-[10px]" title={device.model}>
            {device.model?.split(' ').slice(0, 3).join(' ') || device.serial?.slice(0, 14)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isWifi ? (
            <Wifi size={10} className="text-white/30" />
          ) : (
            <Usb size={10} className="text-white/30" />
          )}
          {isDisconnected && (
            <span className="font-mono rounded-full bg-red-500/10 shrink-0 text-[9px] px-1.5 py-0.5 text-red-400">
              sin conexión
            </span>
          )}
          {!isDisconnected && error && (
            <span className="font-mono rounded-full bg-yellow-500/10 shrink-0 text-[9px] px-1.5 py-0.5 text-yellow-400">
              reconectando
            </span>
          )}
          <span className={`font-mono rounded-full bg-white/[0.05] shrink-0 text-[10px] px-1.5 py-0.5 ${
            error ? 'text-yellow-400' : 'text-white/50'
          }`}>
            {connected ? `${fps} img/s` : '--'}
          </span>
          {zoomed && (
            <span className="font-mono rounded-full bg-white/[0.05] shrink-0 text-[10px] px-1.5 py-0.5 text-white/50">
              {zoomLabel}
            </span>
          )}
        </div>
      </div>

      {/* Interactive screen */}
      <div className={`flex-1 flex items-center justify-center bg-black/60 min-h-0 ${compact ? 'p-1' : 'p-2'}`}>
        <div
          ref={screenRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className={`relative w-full h-full rounded-lg overflow-hidden bg-black/80 select-none touch-none ${
            frameUrl
              ? (zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair')
              : 'cursor-default'
          }`}
        >
          {/* ═══ STATE: Live stream ═══ */}
          {frameUrl && (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  ref={imgRef}
                  src={frameUrl}
                  alt={`Pantalla ${device.model}`}
                  draggable={false}
                  className="max-h-full max-w-full object-contain pointer-events-none"
                  style={{
                    transform: `scale(${zoom.scale})`,
                    transformOrigin: `${zoom.ox * 100}% ${zoom.oy * 100}%`,
                  }}
                />
              </div>

              {/* Zoom bar */}
              <div className={`absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 p-0.5 ${compact ? 'scale-90 origin-top-right' : ''}`}>
                <button
                  type="button"
                  onClick={() => zoomBy(1 / 1.25)}
                  title="Alejar"
                  className="p-1 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ZoomOut size={12} />
                </button>
                <span className="min-w-[2.5rem] text-center text-[10px] font-mono text-white/70">{zoomLabel}</span>
                <button
                  type="button"
                  onClick={() => zoomBy(1.25)}
                  title="Acercar"
                  className="p-1 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ZoomIn size={12} />
                </button>
                {zoomed && (
                  <button
                    type="button"
                    onClick={() => setZoom({ scale: 1, ox: 0.5, oy: 0.5 })}
                    title="Restablecer zoom"
                    className="p-1 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors ml-0.5 border-l border-white/10"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>

              {/* Error overlay */}
              {error && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/70 backdrop-blur-sm pointer-events-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-[9px] text-yellow-400 font-medium">Reconectando...</span>
                </div>
              )}
            </>
          )}

          {/* ═══ STATE: No device connected ═══ */}
          {!frameUrl && isDisconnected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <Smartphone size={28} className="text-white/15" />
                <span className="text-[11px] font-semibold text-white/30">Sin dispositivo</span>
                <span className="text-[9px] text-white/15">Conecta un dispositivo para ver la pantalla</span>
              </div>
              <button
                onClick={retryConnection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/70 hover:bg-white/10 transition-all text-[10px] font-semibold"
              >
                <RefreshCw size={11} /> Reconectar
              </button>
            </div>
          )}

          {/* ═══ STATE: Connecting / no frame yet ═══ */}
          {!frameUrl && !isDisconnected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#22c97d] animate-spin" />
                <span className="text-[11px] font-semibold text-white/30">Conectando pantalla...</span>
                <span className="text-[9px] text-white/15">
                  Conectando transmisión...
                </span>
              </div>
              <button
                onClick={wakeScreen}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22c97d]/10 border border-[#22c97d]/20 text-[#22c97d]/70 hover:text-[#22c97d] hover:bg-[#22c97d]/15 transition-all text-[10px] font-semibold"
              >
                <RefreshCw size={11} /> Despertar pantalla
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
