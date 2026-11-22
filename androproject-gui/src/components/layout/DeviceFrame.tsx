// ============================================================================
// ARCHIVO: DeviceFrame.tsx
// QUÉ HACE: Carcasa interactiva del teléfono que gestiona Fullscreen, estado
//           minimizado, atajos de teclado/portapapeles, popout independiente
//           y renderizado del lienzo de proyección.
// CÓMO FUNCIONA: Delega la cabecera a `DeviceFrameHeader.tsx`, deriva
//           `useMjpegStream` reactivamente desde `isIos` y limpia `pasteTimerRef`
//           y listeners de teclado/fullscreen al desmontar.
// POR QUÉ: Garantizar ciclo de vida sin timers zombis y cumplir SRP < 200L.
// ============================================================================
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useActions } from '@/hooks/useActions';
import { ProjectionCanvas, ZoomState } from '@/components/projection/ProjectionCanvas';
import { DeviceNavControls } from './DeviceNavControls';
import { DeviceFrameHeader } from './DeviceFrameHeader';
import type { DeviceInfo } from '../../features/types';

const KEY_TO_ANDROID: Record<string, string> = {
  ArrowUp: 'KEYCODE_DPAD_UP', ArrowDown: 'KEYCODE_DPAD_DOWN', ArrowLeft: 'KEYCODE_DPAD_LEFT',
  ArrowRight: 'KEYCODE_DPAD_RIGHT', Enter: 'KEYCODE_DPAD_CENTER', Escape: 'KEYCODE_BACK',
  Backspace: 'KEYCODE_DEL', ' ': 'KEYCODE_SPACE', Home: 'KEYCODE_HOME',
};

interface DeviceFrameProps {
  device: DeviceInfo;
  expanded: boolean;
  compact?: boolean;
  onSendKey?: (keycode: string) => void;
  scrcpyActive?: boolean;
  onToggleScrcpy?: () => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({
  device, expanded, onSendKey, scrcpyActive, onToggleScrcpy,
  minimized: propMinimized, onToggleMinimize,
}) => {
  const { run } = useActions();
  const isIos = device.platform === 'ios' || device.serial?.startsWith('airplay-');
  const useMjpegStream = !isIos;
  const [currentFps, setCurrentFps] = useState(0);
  const [localMinimized, setLocalMinimized] = useState(false);
  const minimized = propMinimized !== undefined ? propMinimized : localMinimized;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, ox: 0.5, oy: 0.5 });
  const [textInput, setTextInput] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [pastingClip, setPastingClip] = useState(false);
  const [pastedFeedback, setPastedFeedback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pasteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleMinimize = useCallback(() => {
    if (onToggleMinimize) onToggleMinimize();
    else setLocalMinimized((m) => !m);
  }, [onToggleMinimize]);

  const [resW, resH] = (device?.resolution || '').split(/[×xX]/).map((s) => parseFloat(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
  const deviceRatio = resW && resH ? resW / resH : 9 / 20;

  useEffect(() => () => {
    if (pasteTimerRef.current) clearTimeout(pasteTimerRef.current);
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleMaximize = useCallback(async () => {
    if (minimized) toggleMinimize();
    setZoom({ scale: 1, ox: 0.5, oy: 0.5 });
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (containerRef.current) await containerRef.current.requestFullscreen();
    } catch { /* Fullscreen bloqueado por política del navegador */ }
  }, [minimized, toggleMinimize]);

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
      if (pasteTimerRef.current) clearTimeout(pasteTimerRef.current);
      pasteTimerRef.current = setTimeout(() => { pasteTimerRef.current = null; setPastedFeedback(false); }, 2000);
    } catch {} finally { setPastingClip(false); }
  }, [device.serial, pastingClip, run]);

  useEffect(() => {
    if (!expanded || minimized) return;
    const el = containerRef.current;
    if (!el) return;
    el.setAttribute('tabindex', '0');
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); handlePasteFromPc(); return; }
      const k = KEY_TO_ANDROID[e.key];
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

  return (
    <div ref={containerRef} className="flex flex-col flex-1 min-h-0 min-w-0 bg-zinc-950 outline-none">
      <DeviceFrameHeader
        device={device} isIos={isIos} scrcpyActive={scrcpyActive} onToggleScrcpy={onToggleScrcpy}
        currentFps={currentFps} minimized={minimized} isFullscreen={isFullscreen}
        onToggleMinimize={toggleMinimize} onToggleMaximize={toggleMaximize} onOpenPopout={openIndependentPopout}
      />

      {minimized ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <p className="text-xs text-zinc-400 font-mono">Visor minimizado — {device.model || device.serial}</p>
          <button type="button" onClick={toggleMinimize} className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-100 transition-colors cursor-pointer">
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
          <DeviceNavControls isIos={isIos} textInput={textInput} onTextChange={setTextInput} onSendText={handleSendText} sendingText={sendingText} onPasteFromPc={handlePasteFromPc} pastingClip={pastingClip} pastedFeedback={pastedFeedback} hasSerial={Boolean(device.serial)} onKey={handleKey} />
        </>
      )}
    </div>
  );
};
