'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Maximize2, Minimize2, Volume2, VolumeX, Power, Send, Type,
  Sparkles, RefreshCw, X, ShieldAlert, Smartphone
} from 'lucide-react';
import { ProjectionCanvas, ZoomState } from '@/components/projection/ProjectionCanvas';
import type { DeviceInfo } from '@/features/types';

function PopoutContent() {
  const searchParams = useSearchParams();
  const requestedSerial = searchParams.get('serial') || '';
  const isIos = searchParams.get('device') === 'ios' || requestedSerial.startsWith('airplay-');

  const [device, setDevice] = useState<DeviceInfo>({
    connected: true,
    platform: isIos ? 'ios' : 'android',
    model: isIos ? 'iPhone Pro (AirPlay 2)' : (requestedSerial || 'Dispositivo Android'),
    serial: requestedSerial,
    connectionType: requestedSerial.includes(':') ? 'Wi-Fi' : 'USB',
    state: 'device',
    resolution: isIos ? '1179 × 2556' : '1080 × 2400',
    airplayFps: 60,
  });

  const [currentFps, setCurrentFps] = useState(60);
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, ox: 0, oy: 0 });
  const [textInput, setTextInput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // Poll device info accurately
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/device', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const devList: DeviceInfo[] = data.devices || [];
          const found = devList.find(d => requestedSerial ? d.serial === requestedSerial : (isIos ? d.platform === 'ios' : d.platform !== 'ios'));
          if (found) {
            setDevice(prev => ({ ...prev, ...found }));
          }
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [requestedSerial, isIos]);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    try {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'input_text', text: textInput, serial: device.serial }),
      });
      setTextInput('');
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 select-none overflow-hidden font-sans">
      {/* ═══ Header Bar ═══ */}
      <header className="flex items-center justify-between px-3.5 py-2 bg-zinc-900/95 border-b border-zinc-800 backdrop-blur-md shrink-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
          <span className="text-xs font-semibold tracking-tight text-zinc-100 flex items-center gap-1.5">
            <Smartphone size={14} className="text-zinc-400" />
            <span>{device.model || (isIos ? 'iPhone Pro Mirror' : 'Android Mirror')}</span>
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[9px] font-mono font-medium text-zinc-300">
            {currentFps || 60} FPS
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isIos && (
            <button
              type="button"
              onClick={() => setIsMuted(m => !m)}
              className={`p-1.5 rounded-lg border transition-all ${isMuted ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700'}`}
              title={isMuted ? 'Silenciado' : 'Audio AirPlay Activo'}
            >
              {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
          )}
          <button
            type="button"
            onClick={handleFullscreen}
            className="p-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-all"
            title="Pantalla Completa"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 transition-all"
            title="Cerrar Ventana"
          >
            <X size={13} />
          </button>
        </div>
      </header>

      {/* ═══ Main Device Enclosure Viewport ═══ */}
      <main className="flex-1 flex items-center justify-center p-3 bg-zinc-950 min-h-0 relative overflow-hidden">
        <div
          style={{ aspectRatio: isIos ? '1179 / 2556' : '9 / 19.5' }}
          className="relative h-full max-h-full max-w-full rounded-[38px] p-2 bg-zinc-950 border border-zinc-800/80 shadow-[0_25px_70px_rgba(0,0,0,0.95)] flex flex-col items-center justify-center overflow-hidden ring-1 ring-white/[0.04]"
        >
          {/* Dynamic Island for iOS */}
          {isIos && (
            <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center justify-between px-3.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 shadow-lg min-w-[96px]">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[8px] font-bold text-zinc-200">AirPlay 2</span>
              </div>
            </div>
          )}

          {/* Canvas Viewport */}
          <ProjectionCanvas
            device={device}
            useMjpegStream={false}
            scrcpyActive={true}
            zoom={zoom}
            setZoom={setZoom}
            onFpsUpdate={setCurrentFps}
          />
        </div>
      </main>

      {/* ═══ Text Input Bar ═══ */}
      <form onSubmit={handleSendText} className="flex items-center gap-2 px-3 py-2 bg-zinc-900/95 border-t border-zinc-800 shrink-0">
        <div className="relative flex-1">
          <Type size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Escribir texto en el dispositivo..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={!textInput.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 text-zinc-900 text-xs font-semibold transition-all shadow-sm active:scale-[0.98]"
        >
          <Send size={11} /> Enviar
        </button>
      </form>
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
