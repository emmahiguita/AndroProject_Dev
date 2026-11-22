// ============================================================================
// ARCHIVO: AirPlayStudioCard.tsx
// QUÉ HACE: Tarjeta de control del receptor Apple AirPlay 2 para dispositivos
//           iOS (ventana libre, control de ratón, audio en PC/iPhone, botones
//           físicos, captura PNG, portapapeles, túnel WDA y Bluetooth).
// CÓMO FUNCIONA: Invoca `/api/airplay`, `/api/ios` y `run('keyevent')` con
//           retroalimentación inmediata vía `showToast`.
// POR QUÉ: Separar el estudio iOS del estudio Android mantiene DeviceInfoPanel
//           modular y bajo el límite estricto de 200 líneas (SRP).
// ============================================================================

'use client';

import React, { useState } from 'react';
import {
  Airplay, Maximize2, Sparkles, VolumeX, Home, Lock,
  Volume2, Camera, ClipboardPaste, Zap, Sliders, ExternalLink, Power,
} from 'lucide-react';
import { useAirPlayServer } from '@/hooks/useAirPlayServer';
import type { ScrcpyOptions } from '@/hooks/useProjection';
import { ToggleRow, ToolButton } from './DeviceInfoPrimitives';

interface AirPlayStudioCardProps {
  serial: string;
  dark: boolean;
  cardStyle: string;
  scrcpyOptions: ScrcpyOptions;
  setScrcpyOptions: React.Dispatch<React.SetStateAction<ScrcpyOptions>>;
  onMouseControl?: () => Promise<void> | void;
  onScreenshotClick: () => void;
  onPasteClipboard: () => void;
  run: (action: string, desc: string, extraBody?: Record<string, unknown>, logResult?: boolean) => Promise<any>;
  showToast: (msg: string, isError?: boolean) => void;
}

export const AirPlayStudioCard: React.FC<AirPlayStudioCardProps> = ({
  serial, dark, cardStyle, scrcpyOptions, setScrcpyOptions,
  onMouseControl, onScreenshotClick, onPasteClipboard, run, showToast,
}) => {
  const [mouseControlActive, setMouseControlActive] = useState(false);
  const { status: airplayStatus, loading: airplayLoading, toggleServer } = useAirPlayServer();

  const postJson = async (url: string, payload: Record<string, unknown>, fallbackErr: string) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      showToast(fallbackErr, true);
      return null;
    }
  };

  const handleToggleMouse = async () => {
    const nextState = !mouseControlActive;
    setMouseControlActive(nextState);
    if (onMouseControl) {
      showToast(nextState ? 'Control de ratón activado' : 'Control de ratón desactivado');
      await onMouseControl();
      return;
    }
    const data = await postJson('/api/airplay', { action: 'toggle_mouse_control' }, 'Error de conexión con AirPlay');
    if (data?.success) {
      showToast(nextState ? 'Control de ratón activado' : 'Control de ratón desactivado');
    } else if (data) {
      setMouseControlActive(!nextState);
      showToast(data.error || 'Error activando control de ratón', true);
    } else {
      setMouseControlActive(!nextState);
    }
  };

  return (
    <div className={`rounded-xl border p-3.5 ${cardStyle} space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-200">
            <Airplay size={14} />
          </div>
          <div>
            <h3 className={`text-xs font-semibold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
              Receptor Apple AirPlay 2
            </h3>
            <p className="text-[10px] text-emerald-400">Video H.264 60 FPS • Audio en Celular</p>
          </div>
        </div>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-medium text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 60 FPS
        </span>
      </div>

      <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 font-normal">Nombre en Red:</span>
          <span className="font-medium text-zinc-200 font-mono">{airplayStatus.serverName} (:{airplayStatus.port})</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 font-normal">Estado Receptor:</span>
          <span className={`font-medium font-mono ${airplayStatus.running ? 'text-emerald-400' : 'text-amber-400'}`}>
            {airplayStatus.running ? 'Activo · Bonjour ON' : 'En espera'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          disabled={airplayLoading}
          onClick={async () => {
            showToast(airplayStatus.running ? 'Deteniendo receptor AirPlay...' : 'Iniciando receptor AirPlay...');
            await toggleServer();
          }}
          className="flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
        >
          <Power size={12} className={airplayStatus.running ? 'text-emerald-400' : 'text-zinc-400'} />
          <span>{airplayStatus.running ? 'Activo' : 'Iniciar'}</span>
        </button>

        <button
          type="button"
          onClick={async () => {
            showToast('Abriendo ventana flotante...');
            const data = await postJson('/api/airplay', { action: 'open_native_window' }, 'Error al abrir ventana');
            if (data) showToast('Ventana flotante abierta');
          }}
          className="flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
        >
          <Maximize2 size={12} /><span>Libre</span>
        </button>

        <button
          type="button"
          onClick={handleToggleMouse}
          className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
            mouseControlActive
              ? 'bg-zinc-100 border-zinc-100 text-zinc-950 hover:bg-white'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
          }`}
        >
          <Sparkles size={12} className={mouseControlActive ? 'text-emerald-600' : 'text-zinc-400'} />
          <span>{mouseControlActive ? 'Ratón ON' : 'Ratón'}</span>
        </button>
      </div>

      <div className="pt-1 border-t border-zinc-800/60">
        <ToggleRow
          dark={dark}
          icon={<VolumeX size={12} className="text-emerald-400" />}
          label="Escuchar audio en el PC (Opcional)"
          description="Desactivado por defecto: el sonido se escucha en el celular"
          checked={Boolean(scrcpyOptions.enableAudio)}
          onChange={async (checked) => {
            setScrcpyOptions((o) => ({ ...o, enableAudio: checked }));
            const data = await postJson('/api/airplay', { action: 'set_audio', audioEnabled: checked }, 'Error cambiando salida de audio');
            if (data) showToast(data.message || (checked ? 'Audio en PC activado' : 'Audio en Celular activado'));
          }}
        />
      </div>

      <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
        <span className={`text-[10px] block font-semibold uppercase tracking-wider ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
          Automatización y Botones Físicos iOS
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <ToolButton dark={dark} icon={<Home size={13} className="text-zinc-400" />} label="Inicio (Home)"
            onClick={async () => { showToast('Pulsando botón Inicio...'); await run('keyevent', '', { keycode: 'KEYCODE_HOME', serial }, false); }} />
          <ToolButton dark={dark} icon={<Lock size={13} className="text-zinc-400" />} label="Bloquear Pantalla"
            onClick={async () => { showToast('Bloqueando iPhone...'); await run('keyevent', '', { keycode: 'KEYCODE_POWER', serial }, false); }} />
          <ToolButton dark={dark} icon={<Volume2 size={13} className="text-zinc-400" />} label="Subir Volumen"
            onClick={async () => { showToast('Subiendo volumen'); await run('keyevent', '', { keycode: 'KEYCODE_VOLUME_UP', serial }, false); }} />
          <ToolButton dark={dark} icon={<VolumeX size={13} className="text-zinc-400" />} label="Bajar Volumen"
            onClick={async () => { showToast('Bajando volumen'); await run('keyevent', '', { keycode: 'KEYCODE_VOLUME_DOWN', serial }, false); }} />
          <ToolButton dark={dark} icon={<Camera size={13} className="text-zinc-400" />} label="Captura HD" onClick={onScreenshotClick} />
          <ToolButton dark={dark} icon={<ClipboardPaste size={13} className="text-zinc-400" />} label="Pegar del PC" onClick={onPasteClipboard} />
          <ToolButton dark={dark} icon={<Zap size={13} className="text-zinc-400" />} label="Túnel USB WDA"
            onClick={async () => {
              showToast('Activando túnel USB iOS (puerto 8100)...');
              const data = await postJson('/api/ios', { action: 'start_tunnel', port: 8100 }, 'Error iniciando túnel USB');
              if (data) showToast(data.message || 'Túnel USB WDA activo');
            }} />
          <ToolButton dark={dark} icon={<Sliders size={13} className="text-zinc-400" />} label="Ratón Bluetooth"
            onClick={async () => {
              const data = await postJson('/api/ios', { action: 'open_bluetooth_settings' }, 'Error abriendo Bluetooth');
              if (data) showToast(data.message || 'Ajustes Bluetooth abiertos');
            }} />
          <ToolButton dark={dark} icon={<ExternalLink size={13} className="text-zinc-400" />} label="Espejo iOS (/ios-mirror)"
            onClick={() => { window.open('/ios-mirror', '_blank', 'noopener,noreferrer'); }} />
        </div>
      </div>
    </div>
  );
};
