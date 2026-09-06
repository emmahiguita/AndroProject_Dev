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
  const [retryKey, setRetryKey] = useState(0);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build stream URL (key forces img remount on retry)
  const streamUrl = `/api/device-stream?serial=${encodeURIComponent(serial)}&mode=mjpeg&maxSize=720&maxFps=30`;

  const handleLoad = () => {
    retryCountRef.current = 0; // success — reset retry counter
    onLoad?.();
  };

  const handleError = () => {
    if (retryCountRef.current < 4) {
      // Silent retry: remount the img after a short delay
      retryCountRef.current++;
      const delay = 1000 * retryCountRef.current;
      retryTimerRef.current = setTimeout(() => setRetryKey((k) => k + 1), delay);
    } else {
      // Give up after 4 retries — let the parent show the fallback
      onError?.();
    }
  };

  // Cleanup retry timer on unmount
  useEffect(() => () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); }, []);
  // Reset retry counter when serial changes
  useEffect(() => { retryCountRef.current = 0; setRetryKey(0); }, [serial]);

  return (
    <img
      key={retryKey}
      ref={imgRef}
      src={streamUrl}
      alt={`Stream ${serial}`}
      className={className}
      onLoad={handleLoad}
      onError={handleError}
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

  const [mjpegError, setMjpegError] = useState(false);
  const [mjpegLoaded, setMjpegLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropStatus, setDropStatus] = useState<{
    status: 'uploading' | 'success' | 'error';
    message: string;
  } | null>(null);
  const [ripples, setRipples] = useState<TouchRipple[]>([]);
  const rippleIdRef = useRef(0);

  const isPollingEnabled = !useMjpegStream || mjpegError;
  const { frameUrl, connected: pollingConnected, fps, refreshNow } = useDeviceStream(device.serial, isPollingEnabled);
  // When MJPEG mode is active, treat device as connected if device.state is 'device'
  // (polling hook is disabled so its `connected` value is always false)
  const connected = useMjpegStream ? device.state === 'device' : pollingConnected;
  const { run } = useActions();

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
    setMjpegLoaded(false);
  }, [frameUrl, device?.serial]);

  // Auto-retry MJPEG after 5s if it errored — handles cold-start compilation delays
  useEffect(() => {
    if (!mjpegError || !useMjpegStream) return;
    const t = setTimeout(() => setMjpegError(false), 5000);
    return () => clearTimeout(t);
  }, [mjpegError, useMjpegStream]);

  // ── Touch & gesture dispatchers ──
  const tapDevice = useCallback(async (x: number, y: number) => {
    if (!device?.serial || !Number.isFinite(x) || !Number.isFinite(y)) return;
    setIsSyncing(true);
    await run('input_tap', 'Tap', { x: Math.round(x), y: Math.round(y), serial: device.serial }, false);
    if (!useMjpegStream || mjpegError) refreshNow();
    setIsSyncing(false);
  }, [run, device?.serial, refreshNow, useMjpegStream, mjpegError]);

  const longPressDevice = useCallback(async (x: number, y: number) => {
    if (!device?.serial || !Number.isFinite(x) || !Number.isFinite(y)) return;
    setIsSyncing(true);
    await run('input_swipe', 'Long Press', { x1: Math.round(x), y1: Math.round(y), x2: Math.round(x), y2: Math.round(y), duration: 1000, serial: device.serial }, false);
    if (!useMjpegStream || mjpegError) refreshNow();
    setIsSyncing(false);
  }, [run, device?.serial, refreshNow, useMjpegStream, mjpegError]);

  const swipeDevice = useCallback(async (
    x1: number, y1: number, x2: number, y2: number, duration = 120,
  ) => {
    if (!device?.serial || !Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return;
    setIsSyncing(true);
    await run('input_swipe', 'Gesto', { x1: Math.round(x1), y1: Math.round(y1), x2: Math.round(x2), y2: Math.round(y2), duration, serial: device.serial }, false);
    if (!useMjpegStream || mjpegError) refreshNow();
    setIsSyncing(false);
  }, [run, device?.serial, refreshNow, useMjpegStream, mjpegError]);

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
            onError={() => {
              setMjpegError(true);
            }}
            onLoad={() => {
              setMjpegError(false);
            }}
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
              opacity: 1,
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
                <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-zinc-400 animate-spin" />
                <span className="text-xs text-zinc-400 font-medium">Reconectando captura...</span>
              </div>
            )}
          </>
        )}

        {/* ── Touch Ripples Animation (RicoUI Subtle Monochrome) ── */}
        {ripples.map((r) => (
          <span
            key={r.id}
            className="absolute rounded-full bg-white/30 pointer-events-none animate-ping"
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
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900/90 backdrop-blur-md border border-zinc-800 text-zinc-300 text-[10px] font-mono shadow-sm">
            <Loader2 size={11} className="animate-spin text-zinc-400" />
            <span>Sincronizando...</span>
          </div>
        )}

        {/* ── STATE: Connecting / Waiting for First Frame ── */}
        {!frameUrl && !useMjpegStream && !isDisconnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center w-full h-full bg-zinc-950/90 backdrop-blur-sm z-30">
            <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-zinc-300 animate-spin" />
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Conectando pantalla...</span>
              <span className="text-[11px] text-zinc-500">Sincronizando con {device.model || 'dispositivo'}</span>
            </div>
          </div>
        )}

        {/* ── STATE: Disconnected ── */}
        {!showLiveStream && isDisconnected && (
          <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
            <Smartphone size={32} className="text-zinc-600" />
            <div>
              <span className="text-xs font-semibold text-zinc-300 block">Dispositivo no disponible</span>
              <span className="text-[11px] text-zinc-500">Conecta tu dispositivo vía USB o Wi-Fi ADB</span>
            </div>
          </div>
        )}

        {/* ── Drag & Drop Overlay ── */}
        {isDragOver && (
          <div className="absolute inset-0 bg-zinc-950/90 border-2 border-dashed border-zinc-500 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-50 animate-in fade-in duration-150">
            <UploadCloud size={32} className="text-zinc-200 animate-bounce" />
            <span className="text-xs font-semibold text-zinc-100">Soltar archivo para enviar</span>
            <span className="text-[11px] text-zinc-400">Los APK se instalan automáticamente</span>
          </div>
        )}

        {/* ── Drop Status Toast ── */}
        {dropStatus && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-lg backdrop-blur-md border shadow-lg flex items-center gap-2 z-40 animate-in fade-in slide-in-from-top-2 duration-150 ${
            dropStatus.status === 'uploading' ? 'bg-zinc-900/95 border-zinc-700 text-zinc-200'
            : dropStatus.status === 'success' ? 'bg-zinc-900/95 border-zinc-700 text-emerald-400'
            : 'bg-zinc-900/95 border-red-900/50 text-red-400'
          }`}>
            {dropStatus.status === 'uploading' && <Loader2 size={13} className="animate-spin text-zinc-400" />}
            {dropStatus.status === 'success' && <CheckCircle2 size={13} />}
            {dropStatus.status === 'error' && <AlertCircle size={13} />}
            <span className="text-xs font-medium">{dropStatus.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};
