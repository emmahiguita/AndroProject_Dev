// ============================================================================
// ARCHIVO: AirPlayStudioCard.tsx
// QUÉ HACE: Conecta controles iOS al receptor y muestra sus errores.
// ============================================================================

'use client';
import { apiUrl } from '@/lib/api-url';

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
  run: (action: string, desc: string, extraBody?: Record<string, unknown>, logResult?: boolean) => Promise<unknown>;
  showToast: (msg: string, isError?: boolean) => void;
}

export const AirPlayStudioCard: React.FC<AirPlayStudioCardProps> = ({
  serial, dark, cardStyle, scrcpyOptions, setScrcpyOptions,
  onMouseControl, onScreenshotClick, onPasteClipboard, run, showToast,
}) => {
  const [mouseControlActive, setMouseControlActive] = useState(false);
  const { status: airplayStatus, loading: airplayLoading, error: airplayError, toggleServer } = useAirPlayServer();

  const postJson = async (url: string, payload: Record<string, unknown>, fallbackErr: string) => {
    try {
      const res = await fetch(apiUrl(url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Una respuesta HTTP válida puede contener un fallo funcional del receptor.
      const data = await res.json();
      if (!res.ok || !data.success) { showToast(data.error || fallbackErr, true); return null; }
      return data;
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
          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${dark ? 'bg-zinc-800 text-zinc-200' : 'bg-slate-200 text-slate-800'}`}>
            <Airplay size={14} />
          </div>
          <div>
            <h3 className={`text-xs font-semibold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
              Receptor Apple AirPlay 2
            </h3>
            <p className={`text-[10px] ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Estado del proceso receptor</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${dark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-slate-100 border-slate-300 text-slate-800'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" /> iOS
        </span>
      </div>

      {airplayError && <p role="alert" className="text-xs text-red-500">{airplayError}</p>}
      <div className={`p-2.5 rounded-lg border space-y-2 ${dark ? 'bg-zinc-950/60 border-zinc-800/80' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center justify-between text-[11px]">
          <span className={dark ? 'text-zinc-400 font-normal' : 'text-slate-600 font-normal'}>Nombre en Red:</span>
          <span className={`font-medium font-mono ${dark ? 'text-zinc-200' : 'text-slate-900'}`}>{airplayStatus.serverName} (:{airplayStatus.port})</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className={dark ? 'text-zinc-400 font-normal' : 'text-slate-600 font-normal'}>Estado Receptor:</span>
          <span className={`font-medium font-mono ${airplayStatus.running ? (dark ? 'text-emerald-400' : 'text-emerald-700') : (dark ? 'text-amber-400' : 'text-amber-700')}`}>
            {airplayStatus.running ? 'Proceso activo · Bonjour sin comprobar' : 'En espera'}
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
          className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
            dark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
          }`}
        >
          <Power size={12} className={airplayStatus.running ? (dark ? 'text-emerald-400' : 'text-emerald-600') : (dark ? 'text-zinc-400' : 'text-slate-600')} />
          <span>{airplayStatus.running ? 'Activo' : 'Iniciar'}</span>
        </button>

        <button
          type="button"
          onClick={async () => {
            showToast('Abriendo ventana flotante...');
            const data = await postJson('/api/airplay', { action: 'open_native_window' }, 'Error al abrir ventana');
            if (data) showToast('Ventana flotante abierta');
          }}
          className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
            dark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
          }`}
        >
          <Maximize2 size={12} /><span>Libre</span>
        </button>

        <button
          type="button"
          onClick={handleToggleMouse}
          className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
            mouseControlActive
              ? (dark ? 'bg-zinc-100 border-zinc-100 text-zinc-950 hover:bg-white' : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800')
              : (dark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300')
          }`}
        >
          <Sparkles size={12} className={mouseControlActive ? 'text-emerald-500' : (dark ? 'text-zinc-400' : 'text-slate-600')} />
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
            const data = await postJson('/api/airplay', { action: 'set_audio', audioEnabled: checked }, 'Error cambiando salida de audio');
            if (data) { setScrcpyOptions((o) => ({ ...o, enableAudio: checked })); showToast(data.message || (checked ? 'Audio en PC activado' : 'Audio en Celular activado')); }
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
