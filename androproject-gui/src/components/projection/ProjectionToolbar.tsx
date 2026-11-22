// ============================================================================
// ARCHIVO: ProjectionToolbar.tsx
// QUÉ HACE: Barra superior de acciones rápidas del estudio de proyección
//           (indicador 60 FPS, REC, Restaurar si está minimizado, Multi-Pantalla
//           y Pantalla Completa).
// CÓMO FUNCIONA: Recibe el estado actual de proyección y dispara callbacks sin
//           mantener estado propio (componente presentacional puro, SOLID).
// POR QUÉ: Desacoplar la barra de herramientas de `ProjectionView.tsx` para
//           mantener ambos archivos bajo el límite estricto de 200 líneas.
// ============================================================================
'use client';

import React from 'react';
import { Maximize, Minimize, LayoutGrid, Maximize2, Circle, Square } from 'lucide-react';

interface ProjectionToolbarProps {
  dark: boolean;
  scrcpyActive: boolean;
  isRecording: boolean;
  recordingSeconds?: number;
  onToggleRecord?: () => void;
  fullscreen: boolean;
  minimized: boolean;
  deviceLabel: string;
  multiScreenEnabled: boolean;
  deviceCount: number;
  onRestoreMinimize: () => void;
  onProjectAll: () => void;
  onToggleMultiScreen: () => void;
  onToggleFullscreen: () => void;
}

const fmtTime = (secs = 0) => `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;

export const ProjectionToolbar: React.FC<ProjectionToolbarProps> = ({
  dark, scrcpyActive, isRecording, recordingSeconds = 0, onToggleRecord, fullscreen, minimized, deviceLabel,
  multiScreenEnabled, deviceCount, onRestoreMinimize, onProjectAll,
  onToggleMultiScreen, onToggleFullscreen,
}) => {
  const btnCls = `flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
    dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
  }`;

  return (
    <div className="flex flex-wrap items-center justify-end shrink-0 pb-1 gap-2">
      {minimized && !multiScreenEnabled && (
        <button
          type="button"
          onClick={onRestoreMinimize}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
            dark ? 'bg-zinc-100 border-zinc-100 text-zinc-950 hover:bg-white' : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
          }`}
          title="Restaurar visor del teléfono"
        >
          <Maximize2 size={12} />
          <span>Restaurar ({deviceLabel})</span>
        </button>
      )}

      {scrcpyActive && (
        <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[10px] font-medium ${
          dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-white border-slate-200 text-slate-700'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> VisionNano 60 FPS Activo
        </span>
      )}

      {onToggleRecord ? (
        <button
          type="button"
          onClick={onToggleRecord}
          title={isRecording ? 'Detener grabación MP4' : 'Iniciar grabación MP4'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
            isRecording
              ? 'bg-rose-950/70 border-rose-700/70 text-rose-300 hover:bg-rose-900/70 animate-pulse'
              : btnCls
          }`}
        >
          {isRecording ? <Square size={11} fill="currentColor" /> : <Circle size={11} fill="currentColor" className="text-rose-400" />}
          <span>{isRecording ? `REC ${fmtTime(recordingSeconds)}` : 'Grabar'}</span>
        </button>
      ) : isRecording && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-[9px] font-bold text-red-400 animate-pulse">
          ● REC
        </span>
      )}

      {multiScreenEnabled && deviceCount > 0 && (
        <button type="button" onClick={onProjectAll} className={btnCls} title="Lanzar proyección para todos los dispositivos">
          <span>Proyectar Todas ({deviceCount})</span>
        </button>
      )}

      <button
        type="button"
        onClick={onToggleMultiScreen}
        title={multiScreenEnabled ? 'Volver a vista focal' : 'Activar cuadrícula multi-pantalla'}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
          multiScreenEnabled
            ? (dark ? 'bg-zinc-100 border-zinc-100 text-zinc-950' : 'bg-zinc-900 border-zinc-900 text-white')
            : btnCls
        }`}
      >
        <LayoutGrid size={12} />
        <span>{multiScreenEnabled ? 'Multi-Pantalla ON' : `Multi-Pantalla${deviceCount > 1 ? ` (${deviceCount})` : ''}`}</span>
      </button>

      <button type="button" onClick={onToggleFullscreen} title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} className={btnCls}>
        {fullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
      </button>
    </div>
  );
};
