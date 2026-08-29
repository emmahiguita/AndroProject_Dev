'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Smartphone, Loader2, UploadCloud, CheckCircle2, AlertCircle, MonitorPlay,
} from 'lucide-react';
import { useDeviceStream } from '@/hooks/useDeviceStream';
import { useActions } from '@/hooks/useActions';
import type { DeviceInfo } from '@/features/types';

export interface ZoomState {
  scale: number;
  ox: number;
  oy: number;
}

export interface TouchRipple {
  id: number;
  x: number;
  y: number;
}

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

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const TAP_MOVE_PX = 10;
const TAP_MAX_MS = 500;
const LONG_PRESS_MS = 600;
const MIN_SWIPE_DEVICE_PX = 8;
const WHEEL_DEBOUNCE_MS = 80;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

// ── Internal MJPEG Stream Component ──
interface MjpegStreamViewProps {
  serial: string;
  className?: string;
  style?: React.CSSProperties;
  imgRef?: React.RefObject<HTMLImageElement | null>;
  onError?: () => void;
  onLoad?: () => void;
}

const MjpegStreamView: React.FC<MjpegStreamViewProps> = ({
  serial,
  className,
  style,
  imgRef: externalImgRef,
  onError,
  onLoad,
}) => {
  const internalImgRef = useRef<HTMLImageElement>(null);
  const imgRef = externalImgRef ?? internalImgRef;
  const [connected, setConnected] = useState(false);
  const [errored, setErrored] = useState(false);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const img = imgRef.current;
    const streamUrl = `/api/device-stream?serial=${encodeURIComponent(serial)}&mode=mjpeg&maxSize=720&maxFps=30&bitRate=4M`;

    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }

    img.src = streamUrl;
    setConnected(true);
    setErrored(false);

    const handleLoad = () => {
      setConnected(true);
      setErrored(false);
      onLoad?.();
    };

    const handleError = () => {
      setConnected(false);
      setErrored(true);
      onError?.();
    };

    loadTimeoutRef.current = setTimeout(() => {
      if (!connected && !errored) {
        setErrored(true);
        onError?.();
      }
    }, 2500);

    img.addEventListener('load', handleLoad);
    img.addEventListener('error', handleError);

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      img.removeEventListener('load', handleLoad);
      img.removeEventListener('error', handleError);
      img.src = '';
    };
  }, [serial, onError, onLoad, imgRef]);

  if (errored) return null;

  return (
    <img
      ref={imgRef}
      alt={`Stream ${serial}`}
      className={className}
      style={style ?? {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        pointerEvents: 'none',
        imageRendering: 'auto',
        willChange: 'transform',
      }}
    />
  );
};

/**
 * ProjectionCanvas — Hardware-accelerated GPU/MJPEG interactive video viewport.
 * Provides touch mapping, gestures (tap, long press, swipe, wheel scroll),
 * real-time sync, and drag-and-drop APK/file installation.
 */
export const ProjectionCanvas: React.FC<ProjectionCanvasProps> = ({
  device,
  useMjpegStream = false,
  scrcpyActive,
  onToggleScrcpy,
  zoom,
  setZoom,
  onFpsUpdate,
  className = '',
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  const { frameUrl, connected, fps, refreshNow } = useDeviceStream(device.serial, true);
  const { run } = useActions();

  const [ripples, setRipples] = useState<TouchRipple[]>([]);
  const rippleIdRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropStatus, setDropStatus] = useState<{
    status: 'uploading' | 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [mjpegError, setMjpegError] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  const handleToggleScrcpy = async (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    if (!onToggleScrcpy || isLaunching) return;
    setIsLaunching(true);
    try {
      await onToggleScrcpy();
    } finally {
      setTimeout(() => setIsLaunching(false), 1200);
    }
  };

  useEffect(() => {
    onFpsUpdate?.(fps);
  }, [fps, onFpsUpdate]);

  useEffect(() => {
    setImgError(false);
    setIsSyncing(false);
    setMjpegError(false);
  }, [frameUrl]);

  // ── Touch & gesture dispatchers ──
  const tapDevice = useCallback(async (x: number, y: number) => {
    if (!device?.serial || !Number.isFinite(x) || !Number.isFinite(y)) return;
    setIsSyncing(true);
    await run('input_tap', 'Tap', { x: Math.round(x), y: Math.round(y), serial: device.serial }, false);
    refreshNow();
    setIsSyncing(false);
  }, [run, device?.serial, refreshNow]);

  const longPressDevice = useCallback(async (x: number, y: number) => {
    if (!device?.serial || !Number.isFinite(x) || !Number.isFinite(y)) return;
    setIsSyncing(true);
    await run('input_swipe', 'Long Press', { x1: Math.round(x), y1: Math.round(y), x2: Math.round(x), y2: Math.round(y), duration: 1000, serial: device.serial }, false);
    refreshNow();
    setIsSyncing(false);
  }, [run, device?.serial, refreshNow]);

  const swipeDevice = useCallback(async (
    x1: number, y1: number, x2: number, y2: number, duration = 120,
  ) => {
    if (!device?.serial || !Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return;
    setIsSyncing(true);
    await run('input_swipe', 'Gesto', { x1: Math.round(x1), y1: Math.round(y1), x2: Math.round(x2), y2: Math.round(y2), duration, serial: device.serial }, false);
    refreshNow();
    setIsSyncing(false);
  }, [run, device?.serial, refreshNow]);

  const tapRef = useRef(tapDevice);
  const longPressRef = useRef(longPressDevice);
  const swipeRef = useRef(swipeDevice);
  useEffect(() => {
    tapRef.current = tapDevice;
    longPressRef.current = longPressDevice;
    swipeRef.current = swipeDevice;
  });

  const dragRef = useRef<null | {
    id: number;
    startX: number;
    startY: number;
    startT: number;
    moved: boolean;
    lastX: number;
    lastY: number;
    longPressTimer?: ReturnType<typeof setTimeout>;
  }>(null);

  const wheelLockRef = useRef(0);

  // ── Screen coordinate mapping ──
  const toDevice = useCallback((cx: number, cy: number) => {
    const img = imgRef.current;
    const screen = screenRef.current;
    if (!screen) return null;

    const nw = img?.naturalWidth || 1080;
    const nh = img?.naturalHeight || 2400;
    const rect = img?.getBoundingClientRect() || screen.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const na = nw / nh;
    const ba = rect.width / rect.height;
    let rw = rect.width;
    let rh = rect.height;
    let ox = 0;
    let oy = 0;

    if (ba > na) {
      rw = rect.height * na;
      ox = (rect.width - rw) / 2;
    } else {
      rh = rect.width / na;
      oy = (rect.height - rh) / 2;
    }

    if (rw <= 0 || rh <= 0) return null;

    const s = zoom.scale;
    const el = rect.left + ox;
    const et = rect.top + oy;
    let nx: number;
    let ny: number;

    if (s > 1) {
      nx = (cx - (el + zoom.ox * rw - zoom.ox * rw * s)) / (rw * s);
      ny = (cy - (et + zoom.oy * rh - zoom.oy * rh * s)) / (rh * s);
    } else {
      nx = (cx - el) / rw;
      ny = (cy - et) / rh;
    }

    if (!Number.isFinite(nx) || !Number.isFinite(ny) || nx < -0.05 || ny < -0.05 || nx > 1.05 || ny > 1.05) return null;
    const x = clamp(Math.round(clamp01(nx) * nw), 0, nw - 1);
    const y = clamp(Math.round(clamp01(ny) * nh), 0, nh - 1);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }, [zoom]);

  const toDeviceRef = useRef(toDevice);
  const frameUrlRef = useRef(frameUrl);
  useEffect(() => {
    toDeviceRef.current = toDevice;
    frameUrlRef.current = frameUrl;
  });

  // ── Mouse wheel for scroll/zoom ──
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const img = imgRef.current;
      if (!img?.naturalWidth) return;

      if (e.ctrlKey || e.metaKey) {
        const f = Math.exp(-e.deltaY * 0.002);
        setZoom(z => {
          const r = img.getBoundingClientRect();
          return {
            scale: clamp(z.scale * f, MIN_SCALE, MAX_SCALE),
            ox: clamp01((e.clientX - r.left) / r.width),
            oy: clamp01((e.clientY - r.top) / r.height),
          };
        });
        return;
      }

      const now = performance.now();
      if (now - wheelLockRef.current < WHEEL_DEBOUNCE_MS) return;
      wheelLockRef.current = now;

      const p = toDeviceRef.current(e.clientX, e.clientY);
      if (!p) return;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      const steps = clamp(Math.round(Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY)) / 60), 1, 6);
      const amt = 90 * steps;

      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        const d = e.deltaY > 0 ? 1 : -1;
        swipeRef.current(p.x, clamp(p.y + d * amt, 0, nh), p.x, clamp(p.y - d * amt, 0, nh), 160);
      } else {
        const d = e.deltaX > 0 ? 1 : -1;
        swipeRef.current(clamp(p.x - d * amt, 0, nw), p.y, clamp(p.x + d * amt, 0, nw), p.y, 160);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setZoom]);

  // ── Drag & Drop file / APK handler ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!device.serial || e.dataTransfer.files.length === 0) return;

    const file = e.dataTransfer.files[0];
    const isApk = file.name.toLowerCase().endsWith('.apk');
    setDropStatus({
      status: 'uploading',
      message: isApk ? `Instalando ${file.name}...` : `Transfiriendo ${file.name}...`,
    });

    const fd = new FormData();
    fd.append('file', file);
    fd.append('serial', device.serial);

    try {
      const res = await fetch(isApk ? '/api/install-apk' : '/api/upload-file', { method: 'POST', body: fd });
      const data = await res.json();
      setDropStatus(
        data.success
          ? { status: 'success', message: data.message || (isApk ? 'APK instalada' : 'Archivo enviado a /sdcard/Download/') }
          : { status: 'error', message: data.error || 'Error en la transferencia' },
      );
    } catch (err: unknown) {
      setDropStatus({ status: 'error', message: err instanceof Error ? err.message : 'Error de red' });
    }
    setTimeout(() => setDropStatus(null), 4000);
  };

  // ── Pointer interaction handlers ──
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || imgError || dragRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input')) return;

    e.currentTarget.setPointerCapture?.(e.pointerId);

    const clientX = e.clientX;
    const clientY = e.clientY;

    const longPressTimer = setTimeout(() => {
      if (dragRef.current && !dragRef.current.moved) {
        const p = toDevice(clientX, clientY);
        if (p) {
          longPressRef.current(p.x, p.y);
          dragRef.current.moved = true;
        }
      }
    }, LONG_PRESS_MS);

    dragRef.current = {
      id: e.pointerId,
      startX: clientX,
      startY: clientY,
      startT: performance.now(),
      moved: false,
      lastX: clientX,
      lastY: clientY,
      longPressTimer,
    };

    const sr = screenRef.current?.getBoundingClientRect();
    if (sr) {
      const id = ++rippleIdRef.current;
      setRipples(p => [...p.slice(-4), { id, x: e.clientX - sr.left, y: e.clientY - sr.top }]);
      setTimeout(() => setRipples(p => p.filter(r => r.id !== id)), 400);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input')) return;

    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;

    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) >= TAP_MOVE_PX) {
      d.moved = true;
      if (d.longPressTimer) {
        clearTimeout(d.longPressTimer);
        d.longPressTimer = undefined;
      }
    }

    if (zoom.scale > 1) {
      const img = imgRef.current;
      if (img) {
        const r = img.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setZoom(z => ({
            ...z,
            ox: clamp01(z.ox - (e.clientX - d.lastX) / r.width),
            oy: clamp01(z.oy - (e.clientY - d.lastY) / r.height),
          }));
        }
      }
    }
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input')) {
      if (dragRef.current) {
        if (dragRef.current.longPressTimer) {
          clearTimeout(dragRef.current.longPressTimer);
          dragRef.current.longPressTimer = undefined;
        }
        dragRef.current = null;
      }
      return;
    }

    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;

    if (d.longPressTimer) {
      clearTimeout(d.longPressTimer);
      d.longPressTimer = undefined;
    }

    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    if (!d.moved && performance.now() - d.startT < TAP_MAX_MS) {
      const p = toDevice(d.startX, d.startY);
      if (p) tapRef.current(p.x, p.y);
    } else if (d.moved && zoom.scale === 1) {
      const a = toDevice(d.startX, d.startY);
      const b = toDevice(e.clientX, e.clientY);
      if (a && b && Math.hypot(b.x - a.x, b.y - a.y) >= MIN_SWIPE_DEVICE_PX) {
        swipeRef.current(a.x, a.y, b.x, b.y, clamp(Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 1.2), 60, 600));
      }
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id === e.pointerId) {
      if (dragRef.current.longPressTimer) {
        clearTimeout(dragRef.current.longPressTimer);
      }
      dragRef.current = null;
    }
  };

  const zoomed = zoom.scale > 1;
  const isDisconnected = !connected || device.state !== 'device';
  const showLiveStream = useMjpegStream
    ? Boolean(device.serial && !mjpegError)
    : Boolean(frameUrl && !imgError);

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Screen Canvas Viewport */}
      <div
        ref={screenRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className={`relative w-full h-full rounded-[24px] overflow-hidden bg-black select-none touch-none shadow-inner flex items-center justify-center ${
          showLiveStream ? (zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair') : 'cursor-default'
        }`}
      >
        {/* ── Screen Projection: MJPEG mode ── */}
        {useMjpegStream && device.serial && (
          <MjpegStreamView
            serial={device.serial}
            imgRef={imgRef}
            onError={() => setMjpegError(true)}
            onLoad={() => setMjpegError(false)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              pointerEvents: 'none',
              imageRendering: 'auto',
              willChange: 'transform',
              transform: `scale(${zoom.scale})`,
              transformOrigin: `${zoom.ox * 100}% ${zoom.oy * 100}%`,
              display: mjpegError ? 'none' : undefined,
            }}
          />
        )}

        {/* ── Screen Projection: Snapshot Polling mode ── */}
        {(!useMjpegStream || mjpegError) && frameUrl && (
          <>
            <img
              ref={!useMjpegStream ? imgRef : undefined}
              src={frameUrl}
              alt={`Pantalla ${device.model}`}
              draggable={false}
              onLoad={() => setImgError(false)}
              onError={() => setImgError(true)}
              className={`w-full h-full object-fill pointer-events-none transition-transform duration-75 ${imgError ? 'hidden' : ''}`}
              style={{
                transform: `scale(${zoom.scale})`,
                transformOrigin: `${zoom.ox * 100}% ${zoom.oy * 100}%`,
              }}
            />

            {/* Error overlay */}
            {imgError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center bg-black/60 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-yellow-400 animate-spin" />
                <span className="text-[10px] text-yellow-400 font-medium">Reconectando captura...</span>
              </div>
            )}
          </>
        )}

        {/* ── Touch Ripples Animation ── */}
        {ripples.map((r) => (
          <span
            key={r.id}
            className="absolute rounded-full bg-white/40 pointer-events-none animate-ping"
            style={{
              left: r.x - 12,
              top: r.y - 12,
              width: 24,
              height: 24,
            }}
          />
        ))}

        {/* ── Live Syncing Indicator ── */}
        {isSyncing && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-emerald-500/40 text-emerald-400 text-[10px] font-mono shadow-md animate-pulse">
            <Loader2 size={11} className="animate-spin" />
            <span>Sincronizando ADB...</span>
          </div>
        )}

        {/* ── Mobile Projection Action Button & Live Status ── */}
        {onToggleScrcpy && Boolean(device?.serial) && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center max-w-[92%] pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {scrcpyActive ? (
              <button
                type="button"
                onClick={handleToggleScrcpy}
                disabled={isLaunching}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-950/95 backdrop-blur-md border border-emerald-500/60 text-emerald-300 text-[11px] font-bold shadow-2xl hover:bg-red-950/90 hover:text-red-300 hover:border-red-500/60 transition-all active:scale-95 whitespace-nowrap cursor-pointer select-none"
                title="Hacer clic para detener VisionNano 60 FPS"
              >
                {isLaunching ? (
                  <Loader2 size={12} className="animate-spin text-emerald-400" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
                <span>VisionNano 60 FPS Activo (Detener)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleToggleScrcpy}
                disabled={isLaunching}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1bae6e] hover:bg-[#22c97d] text-white text-[12px] font-bold shadow-2xl shadow-[#1bae6e]/50 transition-all active:scale-95 border border-white/30 animate-pulse whitespace-nowrap cursor-pointer select-none"
                title="Iniciar proyección VisionNano con aceleración GPU Direct3D11 a 60 FPS sin lag"
              >
                {isLaunching ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <MonitorPlay size={14} />
                )}
                <span>{isLaunching ? 'Lanzando VisionNano...' : 'Activar VisionNano 60 FPS'}</span>
              </button>
            )}
          </div>
        )}



        {/* ── STATE: Connecting ── */}
        {!useMjpegStream && !frameUrl && !isDisconnected && (
          <div className="flex flex-col items-center justify-center gap-4 p-4 text-center w-full h-full">
            <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-[#22c97d] animate-spin" />
            <div>
              <span className="text-xs font-bold text-white/70 block">Iniciando proyección...</span>
              <span className="text-[10px] text-white/30">Capturando pantalla de dispositivo Android</span>
            </div>
          </div>
        )}

        {/* ── STATE: Disconnected ── */}
        {!showLiveStream && isDisconnected && (
          <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
            <Smartphone size={32} className="text-white/20" />
            <div>
              <span className="text-xs font-bold text-white/60 block">Sin conexión al dispositivo</span>
              <span className="text-[10px] text-white/30">Conecta tu Android vía USB o Wi-Fi ADB</span>
            </div>
          </div>
        )}

        {/* ── Drag & Drop Overlay ── */}
        {isDragOver && (
          <div className="absolute inset-0 bg-[#1bae6e]/20 border-2 border-dashed border-[#22c97d] backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-50 animate-in fade-in duration-150">
            <UploadCloud size={36} className="text-[#22c97d] animate-bounce" />
            <span className="text-xs font-bold text-white">Soltar archivo para enviar al Android</span>
            <span className="text-[10px] text-white/70">.apk se instala automáticamente · otros archivos van a /sdcard/Download/</span>
          </div>
        )}

        {/* ── Drop Status Toast ── */}
        {dropStatus && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl backdrop-blur-md border shadow-2xl flex items-center gap-2 z-40 animate-in fade-in slide-in-from-top-2 duration-200 ${
            dropStatus.status === 'uploading' ? 'bg-black/90 border-[#22c97d]/30 text-[#22c97d]'
            : dropStatus.status === 'success' ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
            : 'bg-red-950/90 border-red-500/40 text-red-300'
          }`}>
            {dropStatus.status === 'uploading' && <Loader2 size={14} className="animate-spin" />}
            {dropStatus.status === 'success' && <CheckCircle2 size={14} />}
            {dropStatus.status === 'error' && <AlertCircle size={14} />}
            <span className="text-xs font-semibold">{dropStatus.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};
