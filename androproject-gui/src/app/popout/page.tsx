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
  const requestedSerial = searchParams.get('serial') || 'airplay-00008120001004D60160201E';
  const isIos = searchParams.get('device') === 'ios' || requestedSerial.startsWith('airplay-');

  const [device, setDevice] = useState<DeviceInfo>({
    connected: true,
    platform: 'ios',
    model: 'iPhone 16 Pro (AirPlay 2)',
    serial: requestedSerial,
    connectionType: 'Wi-Fi',
    state: 'device',
    resolution: '1179 × 2556',
    airplayFps: 60,
  });

  const [currentFps, setCurrentFps] = useState(60);
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, ox: 0, oy: 0 });
  const [textInput, setTextInput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // Poll device info
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/device', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const devList: DeviceInfo[] = data.devices || [];
          const found = devList.find(d => d.platform === 'ios' || d.serial?.startsWith('airplay-'));
          if (found) {
            setDevice(prev => ({ ...prev, ...found }));
          }
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="flex flex-col h-screen w-screen bg-[#05070c] text-white select-none overflow-hidden font-sans">
      {/* ═══ Header Bar ═══ */}
      <header className="flex items-center justify-between px-3.5 py-2 bg-[#090d16]/95 border-b border-white/10 backdrop-blur-md shrink-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#22c97d]" />
          <span className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
            <span>🍏</span> {device.model || 'iPhone Pro Mirror'}
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-[#00e5ff]/15 border border-[#00e5ff]/30 text-[9px] font-mono font-bold text-[#00e5ff]">
            {currentFps || 60} FPS
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsMuted(m => !m)}
            className={`p-1.5 rounded-lg border transition-all ${isMuted ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'}`}
            title={isMuted ? 'Silenciado' : 'Audio AirPlay Activo'}
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <button
            type="button"
            onClick={handleFullscreen}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
            title="Pantalla Completa"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-all"
            title="Cerrar Ventana"
          >
            <X size={13} />
          </button>
        </div>
      </header>

      {/* ═══ Main Device Enclosure Viewport ═══ */}
      <main className="flex-1 flex items-center justify-center p-3 bg-gradient-to-b from-[#06080e] via-[#0a0f1d] to-[#06080e] min-h-0 relative overflow-hidden">
        <div
          style={{ aspectRatio: '1179 / 2556' }}
          className="relative h-full max-h-full max-w-full rounded-[38px] p-2 bg-[#121622] border-[3px] border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.08)] flex flex-col items-center justify-center"
        >
          {/* Dynamic Island */}
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center justify-between px-3.5 py-1 rounded-full bg-black border border-white/20 shadow-lg min-w-[96px]">
            <div className="w-2.5 h-2.5 rounded-full bg-[#0a0d13] border border-white/30 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[8px] font-extrabold text-white/90">AirPlay 2</span>
            </div>
          </div>

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
      <form onSubmit={handleSendText} className="flex items-center gap-2 px-3 py-2 bg-[#090d16]/95 border-t border-white/10 shrink-0">
        <div className="relative flex-1">
          <Type size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Escribir texto en el iPhone..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs placeholder:text-white/25 focus:outline-none focus:border-[#00e5ff]/50"
          />
        </div>
        <button
          type="submit"
          disabled={!textInput.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#00b4d8] hover:bg-[#0096c7] disabled:opacity-40 text-white text-xs font-bold transition-all shadow-sm"
        >
          <Send size={11} /> Enviar
        </button>
      </form>
    </div>
  );
}

export default function PopoutPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen w-screen bg-[#05070c] text-white text-xs">Cargando proyector iOS...</div>}>
      <PopoutContent />
    </Suspense>
  );
}
