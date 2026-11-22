// ============================================================================
// ARCHIVO: ProjectionToolsCard.tsx
// QUÉ HACE: Tarjetas de Grabador MP4, selector de orientación, control de
//           volumen/navegación y herramientas rápidas del sistema Android.
// CÓMO FUNCIONA: Muestra el cronómetro de grabación, botones Auto/Vertical/
//           Horizontal y ejecuta keyevents y comandos ADB reales.
// POR QUÉ: Conectar todas las acciones de `useProjectionActions` (incluyendo
//          Volumen +/-, Home, Atrás, Recientes) con bordes neutros (< 185L).
// ============================================================================

'use client';

import React from 'react';
import {
  Video, Square, Circle, ClipboardPaste, Camera, LayoutGrid,
  Bell, Sliders, Power, Sun, Settings, VolumeX, Volume2, Volume1,
  PlayCircle, ChevronUp, RotateCcw, Home, ArrowLeft, Layers,
} from 'lucide-react';
import { ToolButton } from './DeviceInfoPrimitives';
import type { RecordActionResult } from '@/hooks/useProjectionTypes';

interface ProjectionToolsCardProps {
  dark: boolean;
  cardStyle: string;
  isRecording: boolean;
  recordingSeconds: number;
  lastRecordedPath?: string | null;
  isBusy: boolean;
  onToggleRecord: () => Promise<RecordActionResult> | void;
  onSetOrientation: (mode: 'auto' | 'portrait' | 'landscape') => void;
  onPasteClipboard: () => void;
  onScreenshotClick: () => void;
  onOpenAllApps?: () => void;
  onGoBack?: () => void;
  onGoHome?: () => void;
  onOpenRecent?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onExpandNotifications: () => void;
  onExpandQuickSettings: () => void;
  onTogglePowerScreen: () => void;
  onWakeScreen?: () => void;
  onOpenSettings?: () => void;
  onToggleMute?: () => void;
  onMediaPlayPause?: () => void;
  onCollapsePanels?: () => void;
  onReboot: () => void;
  onPowerOff: () => void;
  showToast: (msg: string, isError?: boolean) => void;
}

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const ProjectionToolsCard: React.FC<ProjectionToolsCardProps> = ({
  dark, cardStyle, isRecording, recordingSeconds, lastRecordedPath, isBusy,
  onToggleRecord, onSetOrientation, onPasteClipboard, onScreenshotClick,
  onOpenAllApps, onGoBack, onGoHome, onOpenRecent, onVolumeUp, onVolumeDown,
  onExpandNotifications, onExpandQuickSettings, onTogglePowerScreen,
  onWakeScreen, onOpenSettings, onToggleMute, onMediaPlayPause, onCollapsePanels,
  onReboot, onPowerOff, showToast,
}) => {
  const orientBtnCls = `py-1.5 rounded-lg text-[10px] font-medium border transition-colors text-center cursor-pointer ${
    dark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
  }`;

  const handleRecordClick = async () => {
    showToast(isRecording ? 'Deteniendo y guardando MP4...' : 'Iniciando grabación MP4...');
    const res = await onToggleRecord();
    if (res && typeof res === 'object') {
      showToast(res.message || (res.recording ? 'Grabación MP4 en curso' : 'Grabación finalizada'), !res.success);
    }
  };

  return (
    <>
      <div className={`rounded-xl border p-3.5 ${cardStyle} space-y-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video size={14} className={isRecording ? 'text-rose-400 animate-pulse' : 'text-zinc-400'} />
            <h3 className={`text-xs font-semibold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
              Grabador de Pantalla MP4
            </h3>
          </div>
          {isRecording && (
            <span className="font-mono text-[10px] text-rose-400 font-medium px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-700">
              REC {formatTime(recordingSeconds)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleRecordClick}
          disabled={isBusy}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
            isRecording
              ? 'bg-zinc-900 border border-zinc-700 text-rose-300 hover:bg-zinc-800'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
          }`}
        >
          {isRecording ? <Square size={12} fill="currentColor" /> : <Circle size={12} fill="currentColor" className="text-rose-400" />}
          <span>{isRecording ? `Detener Grabación (${formatTime(recordingSeconds)})` : 'Grabar Pantalla (MP4)'}</span>
        </button>

        {lastRecordedPath && !isRecording && (
          <p className="text-[10px] font-mono text-emerald-400 truncate" title={lastRecordedPath}>
            Guardado: {lastRecordedPath.split(/[\\/]/).pop()}
          </p>
        )}
      </div>

      <div className={`rounded-xl border p-3.5 ${cardStyle} space-y-2.5`}>
        <h3 className={`text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
          Herramientas y Sistema
        </h3>

        <div>
          <span className={`text-[10px] block font-medium mb-1.5 ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
            Orientación de Pantalla
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <button type="button" onClick={() => { onSetOrientation('auto'); showToast('Orientación: Automática'); }} className={orientBtnCls}>Auto</button>
            <button type="button" onClick={() => { onSetOrientation('portrait'); showToast('Orientación: Vertical'); }} className={orientBtnCls}>Vertical</button>
            <button type="button" onClick={() => { onSetOrientation('landscape'); showToast('Orientación: Horizontal'); }} className={orientBtnCls}>Horizontal</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <ToolButton dark={dark} icon={<ClipboardPaste size={13} className="text-zinc-400" />} label="Pegar del PC" onClick={onPasteClipboard} />
          <ToolButton dark={dark} icon={<Camera size={13} className="text-zinc-400" />} label="Captura HD" onClick={onScreenshotClick} />
          {onGoBack && <ToolButton dark={dark} icon={<ArrowLeft size={13} className="text-zinc-400" />} label="Atrás" onClick={() => { onGoBack(); showToast('Tecla Atrás'); }} />}
          {onGoHome && <ToolButton dark={dark} icon={<Home size={13} className="text-zinc-400" />} label="Inicio (Home)" onClick={() => { onGoHome(); showToast('Pantalla de Inicio'); }} />}
          {onOpenRecent && <ToolButton dark={dark} icon={<Layers size={13} className="text-zinc-400" />} label="Apps Recientes" onClick={() => { onOpenRecent(); showToast('Multitarea / Recientes'); }} />}
          {onOpenAllApps && <ToolButton dark={dark} icon={<LayoutGrid size={13} className="text-zinc-400" />} label="Todas las Apps" onClick={() => { onOpenAllApps(); showToast('Abriendo cajón de apps'); }} />}
          {onVolumeUp && <ToolButton dark={dark} icon={<Volume2 size={13} className="text-zinc-400" />} label="Subir Volumen" onClick={() => { onVolumeUp(); showToast('Volumen +'); }} />}
          {onVolumeDown && <ToolButton dark={dark} icon={<Volume1 size={13} className="text-zinc-400" />} label="Bajar Volumen" onClick={() => { onVolumeDown(); showToast('Volumen -'); }} />}
          {onToggleMute && <ToolButton dark={dark} icon={<VolumeX size={13} className="text-zinc-400" />} label="Silenciar" onClick={() => { onToggleMute(); showToast('Alternando silencio'); }} />}
          {onMediaPlayPause && <ToolButton dark={dark} icon={<PlayCircle size={13} className="text-zinc-400" />} label="Play / Pausa" onClick={() => { onMediaPlayPause(); showToast('Play / Pausa multimedia'); }} />}
          <ToolButton dark={dark} icon={<Bell size={13} className="text-zinc-400" />} label="Notificaciones" onClick={() => { onExpandNotifications(); showToast('Desplegando notificaciones'); }} />
          <ToolButton dark={dark} icon={<Sliders size={13} className="text-zinc-400" />} label="Ajustes Rápidos" onClick={() => { onExpandQuickSettings(); showToast('Ajustes rápidos'); }} />
          {onCollapsePanels && <ToolButton dark={dark} icon={<ChevronUp size={13} className="text-zinc-400" />} label="Cerrar Paneles" onClick={() => { onCollapsePanels(); showToast('Cerrando paneles'); }} />}
          {onOpenSettings && <ToolButton dark={dark} icon={<Settings size={13} className="text-zinc-400" />} label="Ajustes Sistema" onClick={() => { onOpenSettings(); showToast('Abriendo Ajustes'); }} />}
          <ToolButton dark={dark} icon={<Power size={13} className="text-zinc-400" />} label="Bloquear Pantalla" onClick={() => { onTogglePowerScreen(); showToast('Bloqueando pantalla'); }} />
          {onWakeScreen && <ToolButton dark={dark} icon={<Sun size={13} className="text-zinc-400" />} label="Despertar Pantalla" onClick={() => { onWakeScreen(); showToast('Despertando pantalla'); }} />}
          <ToolButton dark={dark} icon={<RotateCcw size={13} className="text-zinc-400" />} label="Reiniciar" onClick={() => { onReboot(); showToast('Reiniciando...'); }} />
          <ToolButton dark={dark} icon={<Power size={13} className="text-rose-400" />} label="Apagar" onClick={() => { onPowerOff(); showToast('Apagando...'); }} danger />
        </div>
      </div>
    </>
  );
};
