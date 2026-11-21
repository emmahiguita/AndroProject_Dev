// ============================================================================
// ARCHIVO: DeviceFrame.tsx
// QUÉ HACE: Carcasa interactiva del teléfono con barra superior de estado,
//           botones funcionales de ventana (Minimizar, Pantalla Completa y
//           Ventana Independiente por dispositivo) y lienzo H.264 60 FPS.
// CÓMO FUNCIONA: Usa Fullscreen API real para maximizar, estado `minimized`
//           para contraer sin cortar el flujo y ventanas popout con nombre
//           único por serial (ej. OPPO + Samsung A30 en paralelo).
// POR QUÉ: Reparar botones sin lógica real (zoom 2x/reset) y cumplir < 200L.
// ============================================================================
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MonitorPlay, Minus, Square, Minimize2, Maximize2, ExternalLink } from 'lucide-react';
import { useActions } from '@/hooks/useActions';
import { ProjectionCanvas, ZoomState } from '@/components/projection/ProjectionCanvas';
import { DeviceNavControls } from './DeviceNavControls';
import type { DeviceInfo } from '../../features/types';

interface DeviceFrameProps {
  device: DeviceInfo;
  expanded: boolean;
  compact?: boolean;
  onSendKey?: (keycode: string) => void;
  scrcpyActive?: boolean;
  onToggleScrcpy?: () => void;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({
  device, expanded, onSendKey, scrcpyActive, onToggleScrcpy,
}) => {
  const { run } = useActions();
  const isIos = device.platform === 'ios' || device.serial?.startsWith('airplay-');
  const [useMjpegStream] = useState(!isIos);
  const [currentFps, setCurrentFps] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, ox: 0.5, oy: 0.5 });
  const [textInput, setTextInput] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [pastingClip, setPastingClip] = useState(false);
  const [pastedFeedback, setPastedFeedback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [resW, resH] = (device?.resolution || '').split(/[×xX]/).map((s) => parseFloat(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
  const deviceRatio = resW && resH ? resW / resH : 9 / 20;

  // Sincronizar estado de Fullscreen nativo del navegador
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleMaximize = useCallback(async () => {
    setMinimized(false);
    setZoom({ scale: 1, ox: 0.5, oy: 0.5 });
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (containerRef.current) await containerRef.current.requestFullscreen();
    } catch { /* Fullscreen bloqueado por política del navegador */ }
  }, []);

  const openIndependentPopout = useCallback(() => {
    const safeId = (device.serial || 'ios').replace(/[^a-zA-Z0-9]/g, '_');
    const url = isIos ? '/popout?device=ios' : `/popout?serial=${encodeURIComponent(device.serial)}`;
    window.open(url, `AndroProject_Popout_${safeId}`, 'width=440,height=900,resizable=yes,scrollbars=no,status=no');
  }, [device.serial, isIos]);

  const handleKey = useCallback(async (keycode: string) => {
    if (onSendKey) onSendKey(keycode);
    else if (device.serial) await run('keyevent', '', { keycode, serial: device.serial }, false);
  }, [onSendKey, device.serial, run]);

  const handlePasteFromPc = useCallback(async () => {
    if (!device.serial || pastingClip) return;
    setPastingClip(true);
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      await run('paste_clipboard', 'Pegar del PC', { text, serial: device.serial }, false);
      setPastedFeedback(true);
      setTimeout(() => setPastedFeedback(false), 2000);
    } catch {} finally { setPastingClip(false); }
  }, [device.serial, pastingClip, run]);

  useEffect(() => {
    if (!expanded || minimized) return;
    const el = containerRef.current;
    if (!el) return;
    el.setAttribute('tabindex', '0');
    const MAP: Record<string, string> = {
      ArrowUp: 'KEYCODE_DPAD_UP', ArrowDown: 'KEYCODE_DPAD_DOWN', ArrowLeft: 'KEYCODE_DPAD_LEFT',
      ArrowRight: 'KEYCODE_DPAD_RIGHT', Enter: 'KEYCODE_DPAD_CENTER', Escape: 'KEYCODE_BACK',
      Backspace: 'KEYCODE_DEL', ' ': 'KEYCODE_SPACE', Home: 'KEYCODE_HOME',
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); handlePasteFromPc(); return; }
      const k = MAP[e.key];
      if (k) { e.preventDefault(); handleKey(k); }
    };
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [expanded, minimized, handleKey, handlePasteFromPc]);

  const handleSendText = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim() || !device.serial || sendingText) return;
    setSendingText(true);
    try {
      await run('input_text', 'Texto', { text: textInput, serial: device.serial }, false);
      setTextInput('');
    } finally { setSendingText(false); }
  }, [textInput, device.serial, sendingText, run]);

  if (!expanded) return null;
  const isDisconnected = device.state !== 'device';
  const ctrlBtn = 'w-6 h-6 rounded-md border border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer';

  return (
    <div ref={containerRef} className="flex flex-col flex-1 min-h-0 min-w-0 bg-zinc-950 outline-none">
      {/* Cabecera de ventana del dispositivo */}
      <div className="mx-2 mt-1.5 mb-1 px-3 py-1.5 rounded-xl border border-zinc-800/80 bg-zinc-900/70 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md border border-zinc-800 bg-zinc-950 flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/logo.png" alt="AndroProject" className="w-full h-full object-cover" />
          </div>
          <span className="font-semibold text-zinc-100 text-xs tracking-tight truncate">{device.model || 'Android Device'}</span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-800/60 border border-zinc-700/40 text-[10px]">
            <span className={`w-1.5 h-1.5 rounded-full ${isDisconnected ? 'bg-zinc-600' : 'bg-emerald-500'}`} />
            <span className="font-mono text-zinc-300">{device.serial}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleScrcpy && !isIos && (
            <button
              type="button"
              onClick={onToggleScrcpy}
              className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                scrcpyActive ? 'bg-zinc-800 text-emerald-400 border-zinc-700 hover:bg-zinc-700' : 'bg-zinc-800/80 text-zinc-200 border-zinc-700/50 hover:bg-zinc-700'
              }`}
            >
              <MonitorPlay size={12} className={scrcpyActive ? 'text-emerald-400' : 'text-zinc-400'} />
              <span className="hidden sm:inline">{scrcpyActive ? `${currentFps || 60} FPS Activo` : 'Transmitir 60 FPS'}</span>
            </button>
          )}

          {/* Controles reales de ventana: Minimizar, Maximizar (Fullscreen), Popout independiente */}
          <div className="flex items-center gap-1 pl-1 border-l border-zinc-800/80">
            <button type="button" onClick={() => setMinimized((m) => !m)} className={ctrlBtn} title={minimized ? 'Restaurar visor' : 'Minimizar visor'}>
              {minimized ? <Maximize2 size={11} /> : <Minus size={12} />}
            </button>
            <button type="button" onClick={toggleMaximize} className={ctrlBtn} title={isFullscreen ? 'Salir de pantalla completa' : 'Maximizar a pantalla completa'}>
              {isFullscreen ? <Minimize2 size={11} /> : <Square size={10} />}
            </button>
            <button type="button" onClick={openIndependentPopout} className={ctrlBtn} title="Abrir en ventana flotante independiente">
              <ExternalLink size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* Visor interactivo (se contrae limpiamente al minimizar) */}
      {minimized ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <p className="text-xs text-zinc-400 font-mono">Visor minimizado — {device.model || device.serial}</p>
          <button type="button" onClick={() => setMinimized(false)} className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-100 transition-colors cursor-pointer">
            Restaurar pantalla
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center bg-zinc-950 min-h-0 min-w-0 p-1.5 relative overflow-hidden">
            <div style={{ aspectRatio: `${deviceRatio}` }} className="relative h-full max-h-full max-w-full rounded-[30px] p-2 bg-zinc-950 border border-zinc-800/80 shadow-2xl flex flex-col items-center justify-center overflow-hidden ring-1 ring-white/[0.04]">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-zinc-900/90 border border-zinc-800 pointer-events-none">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-950 border border-zinc-700/50" />
                {scrcpyActive && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
              </div>
              <ProjectionCanvas device={device} useMjpegStream={useMjpegStream} scrcpyActive={scrcpyActive} onToggleScrcpy={onToggleScrcpy} zoom={zoom} setZoom={setZoom} onFpsUpdate={setCurrentFps} />
            </div>
          </div>

          <DeviceNavControls
            isIos={isIos} textInput={textInput} onTextChange={setTextInput} onSendText={handleSendText}
            sendingText={sendingText} onPasteFromPc={handlePasteFromPc} pastingClip={pastingClip}
            pastedFeedback={pastedFeedback} hasSerial={Boolean(device.serial)} onKey={handleKey}
          />
        </>
      )}
    </div>
  );
};
