// ============================================================================
// ARCHIVO: page.tsx (/popout)
// QUÉ HACE: Ventana flotante independiente de proyección a 60 FPS por serial
//           con grabación MP4, captura HD, audio/mute real y botonera Android.
// CÓMO FUNCIONA: Habilita WebCodecs H.264 (`useMjpegStream={!isIos}`) en Android,
//           sincroniza el estado del dispositivo cada 3s y conecta cada botón
//           a `/api/actions` o `/api/airplay`.
// POR QUÉ: Inyectar lógica real a todos los controles de la ventana popout (< 200L).
// ============================================================================
'use client';
import { apiUrl } from '@/lib/api-url';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Maximize2, Minimize2, Volume2, VolumeX, Send, Type,
  X, Smartphone, Circle, Square, Camera, ArrowLeft, Home, Layers,
} from 'lucide-react';
import { ProjectionCanvas, ZoomState } from '@/components/projection/ProjectionCanvas';
import type { DeviceInfo } from '@/features/types';

function PopoutContent() {
  const searchParams = useSearchParams();
  const requestedSerial = searchParams.get('serial') || '';
  const isIos = searchParams.get('device') === 'ios' || requestedSerial.startsWith('airplay-');

  const [device, setDevice] = useState<DeviceInfo>({
    connected: true, platform: isIos ? 'ios' : 'android',
    model: isIos ? 'iPhone Pro (AirPlay 2)' : (requestedSerial || 'Dispositivo Android'),
    serial: requestedSerial, connectionType: requestedSerial.includes(':') ? 'Wi-Fi' : 'USB',
    state: 'device', resolution: isIos ? '1179 × 2556' : '1080 × 2400', airplayFps: 60,
  });
  const [currentFps, setCurrentFps] = useState(60);
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, ox: 0.5, oy: 0.5 });
  const [textInput, setTextInput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current); }, []);

  const flashMsg = (msg: string) => {
    setStatusMsg(msg);
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    msgTimerRef.current = setTimeout(() => setStatusMsg(null), 2500);
  };
  const postAction = (payload: Record<string, unknown>) =>
    fetch(apiUrl('/api/actions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serial: device.serial, ...payload }) }).then((r) => r.json());

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(apiUrl('/api/device'), { cache: 'no-store' });
        if (!res.ok || !alive) return;
        const devList: DeviceInfo[] = (await res.json()).devices || [];
        const found = devList.find((d) => (requestedSerial ? d.serial === requestedSerial : (isIos ? d.platform === 'ios' : d.platform !== 'ios')));
        if (found && alive) setDevice((prev) => ({ ...prev, ...found }));
      } catch {}
    };
    void poll();
    const interval = setInterval(() => { void poll(); }, 3000);
    return () => { alive = false; clearInterval(interval); };
  }, [requestedSerial, isIos]);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => {}); setIsFullscreen(true); }
    else { document.exitFullscreen().catch(() => {}); setIsFullscreen(false); }
  };

  const handleToggleMute = async () => {
    const next = !isMuted; setIsMuted(next);
    try {
      if (isIos) await fetch(apiUrl('/api/airplay'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_audio', audioEnabled: !next }) });
      else await postAction({ action: 'keyevent', keycode: 'KEYCODE_VOLUME_MUTE' });
      flashMsg(next ? 'Audio silenciado' : 'Audio activado');
    } catch {}
  };

  const handleToggleRecord = async () => {
    if (isIos) return;
    try {
      if (isRecording) {
        const d = await postAction({ action: 'stop_record' });
        setIsRecording(false);
        flashMsg(d.message || 'Grabación MP4 guardada');
      } else {
        const d = await postAction({ action: 'start_record', bitRate: '16M', maxFps: '60' });
        if (d.success) { setIsRecording(true); flashMsg('Grabando MP4...'); }
        else flashMsg(d.error || 'Error al grabar');
      }
    } catch { flashMsg('Error de grabación'); }
  };

  const handleScreenshot = async () => {
    try {
      const d = await postAction({ action: 'screenshot' });
      flashMsg(d.success ? 'Captura HD guardada' : (d.error || 'Error en captura'));
    } catch { flashMsg('Error al capturar'); }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    try {
      await postAction({ action: 'input_text', text: textInput });
      setTextInput('');
    } catch {}
  };

  const hdrBtn = 'p-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 transition-all cursor-pointer';

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 select-none overflow-hidden font-sans">
      <header className="flex items-center justify-between px-3 py-2 bg-zinc-900/95 border-b border-zinc-800 shrink-0 z-30 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <Smartphone size={14} className="text-zinc-400 shrink-0" />
          <span className="text-xs font-semibold truncate">{device.model || (isIos ? 'iPhone Mirror' : 'Android Mirror')}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[9px] font-mono text-zinc-300 shrink-0">
            {currentFps || 60} FPS
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isIos && (
            <button
              type="button"
              onClick={handleToggleRecord}
              title={isRecording ? 'Detener grabación MP4' : 'Grabar pantalla MP4'}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer ${
                isRecording ? 'bg-rose-950/80 border-rose-700 text-rose-300 animate-pulse' : 'bg-zinc-800/80 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {isRecording ? <Square size={10} fill="currentColor" /> : <Circle size={10} fill="currentColor" className="text-rose-400" />}
              <span>{isRecording ? 'REC' : 'Grabar'}</span>
            </button>
          )}
          <button type="button" onClick={handleScreenshot} className={hdrBtn} title="Captura HD"><Camera size={13} /></button>
          <button type="button" onClick={handleToggleMute} className={hdrBtn} title={isMuted ? 'Activar audio' : 'Silenciar'}>
            {isMuted ? <VolumeX size={13} className="text-rose-300" /> : <Volume2 size={13} />}
          </button>
          <button type="button" onClick={handleFullscreen} className={hdrBtn} title="Pantalla Completa">
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button type="button" onClick={() => window.close()} className={`${hdrBtn} hover:text-rose-300`} title="Cerrar Ventana"><X size={13} /></button>
        </div>
      </header>

      {statusMsg && (
        <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-1 text-[11px] text-center font-mono text-zinc-200 shrink-0">
          {statusMsg}
        </div>
      )}

      <main className="flex-1 flex items-center justify-center p-2.5 bg-zinc-950 min-h-0 relative overflow-hidden">
        <div
          style={{ aspectRatio: isIos ? '1179 / 2556' : '9 / 19.5' }}
          className="relative h-full max-h-full max-w-full rounded-[34px] p-2 bg-zinc-950 border border-zinc-800/80 shadow-2xl flex flex-col items-center justify-center overflow-hidden ring-1 ring-white/[0.04]"
        >
          <ProjectionCanvas device={device} useMjpegStream={!isIos} scrcpyActive={true} zoom={zoom} setZoom={setZoom} onFpsUpdate={setCurrentFps} />
        </div>
      </main>

      <form onSubmit={handleSendText} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/95 border-t border-zinc-800 shrink-0">
        <div className="relative flex-1">
          <Type size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)}
            placeholder="Escribir texto en el dispositivo..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <button type="submit" disabled={!textInput.trim()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 text-zinc-900 text-xs font-semibold cursor-pointer">
          <Send size={11} /> Enviar
        </button>
      </form>

      <div className="grid grid-cols-3 gap-1.5 px-3 py-1.5 bg-zinc-950 border-t border-zinc-800/70 shrink-0">
        <button type="button" onClick={() => postAction({ action: 'keyevent', keycode: 'KEYCODE_BACK' })} className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 cursor-pointer"><ArrowLeft size={12} /> Atrás</button>
        <button type="button" onClick={() => postAction({ action: 'keyevent', keycode: 'KEYCODE_HOME' })} className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 cursor-pointer"><Home size={12} /> Inicio</button>
        <button type="button" onClick={() => postAction({ action: 'keyevent', keycode: 'KEYCODE_APP_SWITCH' })} className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 cursor-pointer"><Layers size={12} /> Recientes</button>
      </div>
    </div>
  );
}

export default function PopoutPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen w-screen bg-zinc-950 text-zinc-300 text-xs">Cargando proyector...</div>}>
      <PopoutContent />
    </Suspense>
  );
}
