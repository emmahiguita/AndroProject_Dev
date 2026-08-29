'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshCw, Wifi, Usb, ArrowLeft, Home, Layers,
  Volume2, VolumeX, Power, Send, Type, MonitorPlay, LayoutGrid,
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
  const [useMjpegStream, setUseMjpegStream] = useState(true);
  const [currentFps, setCurrentFps] = useState(0);

  // Zoom state passed down to ProjectionCanvas
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, ox: 0.5, oy: 0.5 });
  const [textInput, setTextInput] = useState('');
  const [sendingText, setSendingText] = useState(false);

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

      {/* ═══ Header Bar ═══ */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0 bg-white/[0.02]">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            isDisconnected ? 'bg-red-500' : 'bg-[#22c97d] animate-pulse'
          }`} />
          <span className="font-bold truncate text-white text-xs" title={device.model}>
            {device.model?.split(' ').slice(0, 3).join(' ') || device.serial?.slice(0, 14)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isWifi ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <Wifi size={11} /> Wi-Fi
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-white/50 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
              <Usb size={11} /> USB
            </span>
          )}

          {isDisconnected && (
            <span className="font-mono rounded-full bg-red-500/10 shrink-0 text-[9px] px-2 py-0.5 text-red-400 border border-red-500/20">
              desconectado
            </span>
          )}

          {/* Live Stream Mode & FPS Badge */}
          <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
            useMjpegStream
              ? 'text-emerald-400/90 bg-emerald-500/10 border-emerald-500/20'
              : 'text-white/60 bg-white/5 border-white/10'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${useMjpegStream ? 'bg-emerald-400 animate-ping' : 'bg-white/40'}`} />
            <span className="font-mono text-[9px]">
              {useMjpegStream ? (currentFps > 0 ? `STREAM ${currentFps} FPS` : 'STREAM 30 FPS') : (currentFps > 0 ? `${currentFps} FPS` : 'POLLING')}
            </span>
          </div>

          {/* Stream Mode Switcher Button */}
          <button
            type="button"
            onClick={toggleStreamMode}
            className={`p-1 rounded-lg transition-colors ${
              useMjpegStream
                ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title={useMjpegStream ? 'Modo actual: MJPEG Stream (Clic para cambiar a Polling)' : 'Modo actual: Polling Snapshot (Clic para cambiar a MJPEG)'}
          >
            <MonitorPlay size={12} />
          </button>

          {/* Scrcpy 60 FPS Native Active/Launcher Badge */}
          {onToggleScrcpy && (
            <button
              type="button"
              onClick={onToggleScrcpy}
              className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-xl transition-all shadow-sm ${
                scrcpyActive
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40'
                  : 'bg-[#1bae6e] text-white hover:bg-[#22c97d] shadow-[#1bae6e]/20 active:scale-95'
              }`}
              title={scrcpyActive ? 'Cerrar ventana nativa 60 FPS' : 'Iniciar ventana nativa con aceleración por hardware (60 FPS)'}
            >
              <MonitorPlay size={11} className={scrcpyActive ? 'animate-pulse' : ''} />
              <span>{scrcpyActive ? '60 FPS ACTIVO' : 'Soltar 60 FPS'}</span>
            </button>
          )}

          {zoomed && (
            <span className="font-mono rounded-full bg-white/[0.05] shrink-0 text-[10px] px-2 py-0.5 text-white/50">
              {zoomLabel}
            </span>
          )}
        </div>
      </div>

      {/* ═══ Interactive Screen Viewport ═══ */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#06080e] via-[#090d15] to-[#06080e] min-h-0 p-2.5 relative overflow-hidden">
        {/* Smartphone Bezel Enclosure */}
        <div className="relative h-full max-h-full aspect-[9/19.8] max-w-full rounded-[34px] p-2 bg-[#121620] border-[2.5px] border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)] flex flex-col items-center justify-center">

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
