'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshCw, Wifi, Usb, ArrowLeft, Home, Layers,
  Volume2, VolumeX, Power, Send, Type, MonitorPlay, LayoutGrid,
  Activity, Minus, Square, X,
} from 'lucide-react';
import { useActions } from '@/hooks/useActions';
import { ProjectionCanvas, ZoomState } from '@/components/projection/ProjectionCanvas';
import type { DeviceInfo } from '../../features/types';

interface DeviceFrameProps {
  device: DeviceInfo;
  expanded: boolean;
  compact?: boolean;
  onSendKey?: (keycode: string) => void;
  scrcpyActive?: boolean;
  onToggleScrcpy?: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * DeviceFrame — Interactive hardware enclosure with bezel, hardware keys,
 * text input synthesizer, and embedded ProjectionCanvas viewport.
 */
export const DeviceFrame: React.FC<DeviceFrameProps> = ({
  device,
  expanded,
  onSendKey,
  scrcpyActive,
  onToggleScrcpy,
}) => {
  const { run } = useActions();
  const [useMjpegStream, setUseMjpegStream] = useState(false);
  const [currentFps, setCurrentFps] = useState(0);

  // Zoom state passed down to ProjectionCanvas
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, ox: 0.5, oy: 0.5 });
  const [textInput, setTextInput] = useState('');
  const [sendingText, setSendingText] = useState(false);

  // Dynamic screen ratio from device resolution (e.g. 1080x2400 -> 0.45)
  const [resW, resH] = (device?.resolution || '')
    .split(/[×xX]/)
    .map((s) => parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const deviceRatio = resW && resH ? resW / resH : 9 / 20;

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Hardware Key Handlers ──
  const handleKey = useCallback(async (keycode: string) => {
    if (onSendKey) {
      onSendKey(keycode);
    } else if (device.serial) {
      await run('keyevent', '', { keycode, serial: device.serial }, false);
    }
  }, [onSendKey, device.serial, run]);

  // Global keyboard shortcuts when device is expanded
  useEffect(() => {
    if (!expanded) return;
    const el = containerRef.current;
    if (!el) return;
    el.setAttribute('tabindex', '0');

    const MAP: Record<string, string> = {
      ArrowUp: 'KEYCODE_DPAD_UP',
      ArrowDown: 'KEYCODE_DPAD_DOWN',
      ArrowLeft: 'KEYCODE_DPAD_LEFT',
      ArrowRight: 'KEYCODE_DPAD_RIGHT',
      Enter: 'KEYCODE_DPAD_CENTER',
      Escape: 'KEYCODE_BACK',
      Backspace: 'KEYCODE_DEL',
      ' ': 'KEYCODE_SPACE',
      Home: 'KEYCODE_HOME',
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = MAP[e.key];
      if (k) {
        e.preventDefault();
        handleKey(k);
      }
    };

    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [expanded, handleKey]);

  // ── Text input transmitter ──
  const handleSendText = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim() || !device.serial || sendingText) return;
    setSendingText(true);
    try {
      await run('input_text', 'Texto', { text: textInput, serial: device.serial }, false);
      setTextInput('');
    } finally {
      setSendingText(false);
    }
  }, [textInput, device.serial, sendingText, run]);

  const toggleStreamMode = useCallback(() => {
    setUseMjpegStream((prev) => !prev);
  }, []);

  if (!expanded) return null;

  const zoomed = zoom.scale > 1;
  const zoomLabel = `${Math.round(zoom.scale * 100)}%`;
  const isWifi = device.connectionType === 'Wi-Fi';
  const isDisconnected = device.state !== 'device';

  return (
    <div ref={containerRef} className="flex flex-col flex-1 min-h-0 min-w-0 bg-[#080b11] outline-none">

      {/* ═══ Futuristic Cybernetic Header Bar (AndroProject Reverse Agent Bridge) ═══ */}
      <div className="mx-2.5 mt-2 mb-1 px-3.5 py-2 rounded-2xl border border-[#00e5ff]/35 bg-gradient-to-r from-[#070e1a] via-[#0a182c] to-[#040912] shadow-[0_8px_25px_-5px_rgba(0,229,255,0.2)] flex items-center justify-between relative overflow-hidden backdrop-blur-xl shrink-0 ring-1 ring-white/10">
        
        {/* Left Side: Squircle Logo + AndroProject Title + Pulse Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl border border-[#00e5ff]/50 bg-black/70 shadow-md shadow-[#00e5ff]/25 p-0.5 flex items-center justify-center shrink-0 ring-1 ring-white/20">
            <img src="/logo.png" alt="AndroProject" className="w-full h-full object-cover rounded-lg" />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-extrabold text-white text-sm md:text-base tracking-wide drop-shadow-[0_2px_8px_rgba(0,229,255,0.5)] truncate">
              AndroProject
            </span>

            {/* Reverse Agent Bridge Monitor Heartbeat Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00e5ff]/10 border border-[#00e5ff]/30 text-[10px] font-semibold text-[#00e5ff] shadow-sm shadow-[#00e5ff]/15">
              <Activity size={11} className="text-[#00e5ff] animate-pulse" />
              <span className="truncate">Reverse Agent Bridge Monitor</span>
            </div>
          </div>
        </div>

        {/* Right Side: Device status + VisionNano + Cybernetic Window Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Device model / Connection badge */}
          <div className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/70">
            <span className={`w-1.5 h-1.5 rounded-full ${isDisconnected ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="truncate max-w-[100px] font-medium">{device.model || 'Android'}</span>
          </div>

          {/* Quick VisionNano Toggle */}
          {onToggleScrcpy && (
            <button
              type="button"
              onClick={onToggleScrcpy}
              className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                scrcpyActive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/30 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40'
                  : 'bg-[#00e5ff]/10 text-[#00e5ff] border-[#00e5ff]/25 hover:bg-[#00e5ff]/20'
              }`}
              title={scrcpyActive ? 'VisionNano Direct3D11 Activo (Clic para cerrar)' : 'Abrir VisionNano 60 FPS Direct3D11'}
            >
              <MonitorPlay size={11} className={scrcpyActive ? 'text-emerald-400 animate-pulse' : 'text-[#00e5ff]'} />
              <span className="hidden xl:inline">{scrcpyActive ? '60 FPS Activo' : 'VisionNano'}</span>
            </button>
          )}

          {/* Cybernetic Window Action Buttons */}
          <div className="flex items-center gap-1 pl-1">
            {/* Minimize / Zoom reset */}
            <button
              type="button"
              onClick={() => setZoom({ scale: 1, ox: 0.5, oy: 0.5 })}
              className="w-6 h-6 rounded-md border border-[#00e5ff]/25 bg-[#081220]/90 text-[#00e5ff]/80 hover:text-[#00e5ff] hover:bg-[#00e5ff]/20 hover:border-[#00e5ff]/50 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              title="Restablecer vista"
            >
              <Minus size={12} strokeWidth={2.5} />
            </button>

            {/* Maximize / Zoom toggle */}
            <button
              type="button"
              onClick={() => setZoom(z => ({ ...z, scale: z.scale > 1 ? 1 : 2 }))}
              className="w-6 h-6 rounded-md border border-[#00e5ff]/25 bg-[#081220]/90 text-[#00e5ff]/80 hover:text-[#00e5ff] hover:bg-[#00e5ff]/20 hover:border-[#00e5ff]/50 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              title="Maximizar escala de proyección"
            >
              <Square size={10} strokeWidth={2.5} />
            </button>

            {/* Close / Stop projection */}
            <button
              type="button"
              onClick={() => {
                if (scrcpyActive && onToggleScrcpy) onToggleScrcpy();
              }}
              className="w-6 h-6 rounded-md border border-[#00e5ff]/25 bg-[#081220]/90 text-[#00e5ff]/80 hover:text-rose-300 hover:bg-rose-500/25 hover:border-rose-500/50 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              title="Detener proyección VisionNano"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Interactive Screen Viewport ═══ */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#06080e] via-[#090d15] to-[#06080e] min-h-0 p-2.5 relative overflow-hidden">
        {/* Smartphone Bezel Enclosure */}
        <div style={{ aspectRatio: `${deviceRatio}` }} className="relative h-full max-h-full max-w-full rounded-[34px] p-2 bg-[#121620] border-[2.5px] border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)] flex flex-col items-center justify-center">

          {/* Camera Notch */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/90 border border-white/15 shadow-md">
            <div className="w-2.5 h-2.5 rounded-full bg-[#0a0d13] border border-white/20 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-blue-500/80" />
            </div>
            {scrcpyActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
          </div>

          {/* Hardware Accelerated Interactive Projection Canvas */}
          <ProjectionCanvas
            device={device}
            useMjpegStream={useMjpegStream}
            scrcpyActive={scrcpyActive}
            onToggleScrcpy={onToggleScrcpy}
            zoom={zoom}
            setZoom={setZoom}
            onFpsUpdate={setCurrentFps}
          />
        </div>
      </div>

      {/* ═══ Text Input Bar ═══ */}
      <form onSubmit={handleSendText} className="flex items-center gap-2 px-3 py-2 border-t border-white/5 bg-white/[0.015] shrink-0">
        <div className="relative flex-1">
          <Type size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Escribir texto en el dispositivo Android..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-[#22c97d]/50"
          />
        </div>
        <button
          type="submit"
          disabled={!textInput.trim() || sendingText}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1bae6e] hover:bg-[#22c97d] disabled:opacity-40 text-white text-xs font-bold transition-all shadow-sm shadow-[#1bae6e]/20"
        >
          <Send size={11} /> Enviar
        </button>
      </form>

      {/* ═══ Hardware Navigation Bar ═══ */}
      <div className="grid grid-cols-7 gap-1 px-2 py-1.5 border-t border-white/5 bg-black/40 shrink-0">
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_BACK')}
          title="Atrás (Escape)"
          className="flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl text-[9px] font-semibold bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/5 transition-all min-w-0"
        >
          <ArrowLeft size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Atrás</span>
        </button>
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_HOME')}
          title="Inicio (Home)"
          className="flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl text-[9px] font-bold bg-[#1bae6e]/15 text-[#22c97d] hover:bg-[#1bae6e]/25 border border-[#1bae6e]/25 transition-all min-w-0"
        >
          <Home size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Inicio</span>
        </button>
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_ALL_APPS')}
          title="Menú de Aplicaciones (App Drawer)"
          className="flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl text-[9px] font-bold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all min-w-0"
        >
          <LayoutGrid size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Apps</span>
        </button>
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_APP_SWITCH')}
          title="Aplicaciones Recientes"
          className="flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl text-[9px] font-semibold bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/5 transition-all min-w-0"
        >
          <Layers size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Recientes</span>
        </button>
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_POWER')}
          title="Suspender / Despertar Pantalla"
          className="flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl text-[9px] font-semibold bg-white/[0.03] text-amber-400/80 hover:text-amber-300 hover:bg-white/[0.08] border border-white/5 transition-all min-w-0"
        >
          <Power size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Pantalla</span>
        </button>
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_VOLUME_DOWN')}
          title="Bajar Volumen"
          className="flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl text-[9px] font-semibold bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/5 transition-all min-w-0"
        >
          <VolumeX size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Vol-</span>
        </button>
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_VOLUME_UP')}
          title="Subir Volumen"
          className="flex flex-col items-center justify-center gap-0.5 py-1 px-0.5 rounded-xl text-[9px] font-semibold bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/5 transition-all min-w-0"
        >
          <Volume2 size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Vol+</span>
        </button>
      </div>

    </div>
  );
};
