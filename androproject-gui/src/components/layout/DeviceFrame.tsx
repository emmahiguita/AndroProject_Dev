'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshCw, Wifi, Usb, ArrowLeft, Home, Layers,
  Volume2, VolumeX, Power, Send, Type, MonitorPlay, LayoutGrid,
  Activity, Minus, Square, X, ExternalLink, ClipboardPaste, Clipboard, Check,
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
 * text input synthesizer, PC clipboard synchronizer, and embedded ProjectionCanvas viewport.
 */
export const DeviceFrame: React.FC<DeviceFrameProps> = ({
  device,
  expanded,
  onSendKey,
  scrcpyActive,
  onToggleScrcpy,
}) => {
  const { run } = useActions();
  const isIos = device.platform === 'ios' || device.serial?.startsWith('airplay-');
  const [useMjpegStream, setUseMjpegStream] = useState(false);
  const [currentFps, setCurrentFps] = useState(0);

  // Zoom state passed down to ProjectionCanvas
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, ox: 0.5, oy: 0.5 });
  const [textInput, setTextInput] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [pastingClip, setPastingClip] = useState(false);
  const [pastedFeedback, setPastedFeedback] = useState(false);

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

  // ── Paste PC Clipboard to Device ──
  const handlePasteFromPc = useCallback(async () => {
    if (!device.serial || pastingClip) return;
    setPastingClip(true);
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      await run('paste_clipboard', 'Pegar del PC', { text, serial: device.serial }, false);
      setPastedFeedback(true);
      setTimeout(() => setPastedFeedback(false), 2000);
    } catch (err) {
      console.warn('[Clipboard] Error leyendo portapapeles de la PC:', err);
    } finally {
      setPastingClip(false);
    }
  }, [device.serial, pastingClip, run]);

  // Global keyboard shortcuts and clipboard paste when device is expanded
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
      Notification: 'KEYCODE_NOTIFICATION',
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      // Ctrl + V / Cmd + V in canvas -> paste from PC clipboard
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePasteFromPc();
        return;
      }

      const k = MAP[e.key];
      if (k) {
        e.preventDefault();
        handleKey(k);
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const text = e.clipboardData?.getData('text');
      if (text && device.serial) {
        e.preventDefault();
        run('paste_clipboard', 'Pegar del PC', { text, serial: device.serial }, false);
        setPastedFeedback(true);
        setTimeout(() => setPastedFeedback(false), 2000);
      }
    };

    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('paste', onPaste);
    return () => {
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('paste', onPaste);
    };
  }, [expanded, handleKey, handlePasteFromPc, device.serial, run]);

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

  const isDisconnected = device.state !== 'device';

  return (
    <div ref={containerRef} className="flex flex-col flex-1 min-h-0 min-w-0 bg-zinc-950 outline-none">

      {/* ═══ Header Bar (RicoUI Minimalist Design) ═══ */}
      <div className="mx-2 mt-1.5 mb-1 px-3 py-1.5 rounded-xl border border-zinc-800/80 bg-zinc-900/60 shadow-sm flex items-center justify-between backdrop-blur-md shrink-0">
        
        {/* Left Side: Brand Logo + Device Title + Status */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md border border-zinc-800 bg-zinc-950 flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/logo.png" alt="AndroProject" className="w-full h-full object-cover" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-zinc-100 text-xs tracking-tight truncate">
              {device.model || (isIos ? 'Apple Device' : 'Android Device')}
            </span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-800/50 border border-zinc-700/40 text-[10px] text-zinc-400">
              <span className={`w-1.5 h-1.5 rounded-full ${isDisconnected ? 'bg-zinc-600' : 'bg-emerald-500'}`} />
              <span className="font-mono text-[10px] text-zinc-300">{device.serial}</span>
            </div>
          </div>
        </div>

        {/* Right Side: VisionNano + Window Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick VisionNano Toggle */}
          {onToggleScrcpy && !isIos && (
            <button
              type="button"
              onClick={onToggleScrcpy}
              className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                scrcpyActive
                  ? 'bg-zinc-800 text-emerald-400 border-zinc-700 hover:bg-zinc-700'
                  : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 border-zinc-700/50'
              }`}
              title={scrcpyActive ? 'VisionNano 60 FPS Activo (Clic para detener)' : 'Iniciar VisionNano 60 FPS nativo Direct3D11'}
            >
              <MonitorPlay size={12} className={scrcpyActive ? 'text-emerald-400' : 'text-zinc-400'} />
              <span className="hidden sm:inline">{scrcpyActive ? '60 FPS Activo' : 'VisionNano 60 FPS'}</span>
            </button>
          )}

          {/* Window Action Buttons */}
          <div className="flex items-center gap-1 pl-1 border-l border-zinc-800/80">
            {/* Reset Zoom */}
            <button
              type="button"
              onClick={() => setZoom({ scale: 1, ox: 0.5, oy: 0.5 })}
              className="w-6 h-6 rounded-md border border-zinc-800/80 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Restablecer zoom"
            >
              <Minus size={12} />
            </button>

            {/* Toggle Zoom */}
            <button
              type="button"
              onClick={() => setZoom(z => ({ ...z, scale: z.scale > 1 ? 1 : 2 }))}
              className="w-6 h-6 rounded-md border border-zinc-800/80 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Alternar escala"
            >
              <Square size={10} />
            </button>

            {/* Popout Window */}
            <button
              type="button"
              onClick={() => {
                const url = isIos ? '/popout?device=ios' : `/popout?serial=${encodeURIComponent(device.serial)}`;
                window.open(url, 'AndroProject_Popout', 'width=480,height=980,resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no,location=no');
              }}
              className="w-6 h-6 rounded-md border border-zinc-800/80 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Abrir en ventana independiente"
            >
              <ExternalLink size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Interactive Screen Viewport ═══ */}
      <div className="flex-1 flex items-center justify-center bg-zinc-950 min-h-0 min-w-0 p-1.5 relative overflow-hidden">
        {/* Smartphone Bezel Enclosure */}
        <div
          style={{ aspectRatio: `${deviceRatio}` }}
          className="relative h-full max-h-full max-w-full rounded-[30px] p-2 bg-zinc-950 border border-zinc-800/80 shadow-2xl flex flex-col items-center justify-center overflow-hidden ring-1 ring-white/[0.04]"
        >
          {/* Subtle Camera Island */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-zinc-900/90 border border-zinc-800 shadow-sm pointer-events-none">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-950 border border-zinc-700/50" />
            {scrcpyActive && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
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
      <form onSubmit={handleSendText} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 shrink-0 border-t border-zinc-800/80">
        <div className="relative flex-1">
          <Type size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={isIos ? "Escribir en el dispositivo..." : "Escribir texto en Android..."}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900/70 border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={handlePasteFromPc}
          disabled={pastingClip || !device.serial}
          title="Pegar texto copiado en la PC (Ctrl + V)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
        >
          {pastedFeedback ? <Check size={12} className="text-emerald-400" /> : <ClipboardPaste size={12} />}
          <span className="hidden sm:inline">{pastedFeedback ? 'Pegado' : 'Pegar PC'}</span>
        </button>
        <button
          type="submit"
          disabled={!textInput.trim() || sendingText}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-40 shadow-sm cursor-pointer"
        >
          <Send size={11} />
          <span>Enviar</span>
        </button>
      </form>

      {/* ═══ Hardware Navigation Bar (RicoUI Monochromatic Minimalist Style) ═══ */}
      <div className="grid grid-cols-7 gap-1 px-2.5 py-1.5 bg-zinc-950 shrink-0 border-t border-zinc-800/50">
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_BACK')}
          title="Atrás (Escape)"
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium bg-zinc-900/40 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/40 transition-colors"
        >
          <ArrowLeft size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Atrás</span>
        </button>
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_HOME')}
          title="Inicio (Home)"
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium bg-zinc-900/40 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/40 transition-colors"
        >
          <Home size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Inicio</span>
        </button>
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_ALL_APPS')}
          title="Menú de Aplicaciones (App Drawer)"
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium bg-zinc-900/40 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/40 transition-colors"
        >
          <LayoutGrid size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Apps</span>
        </button>
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_APP_SWITCH')}
          title="Aplicaciones Recientes"
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium bg-zinc-900/40 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/40 transition-colors"
        >
          <Layers size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Recientes</span>
        </button>
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_POWER')}
          title="Suspender / Despertar Pantalla"
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium bg-zinc-900/40 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/40 transition-colors"
        >
          <Power size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Pantalla</span>
        </button>
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_VOLUME_DOWN')}
          title="Bajar Volumen"
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium bg-zinc-900/40 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/40 transition-colors"
        >
          <VolumeX size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Vol-</span>
        </button>
        <button
          type="button"
          onClick={() => handleKey('KEYCODE_VOLUME_UP')}
          title="Subir Volumen"
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium bg-zinc-900/40 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/40 transition-colors"
        >
          <Volume2 size={12} className="shrink-0" />
          <span className="truncate w-full text-center">Vol+</span>
        </button>
      </div>

    </div>
  );
};
