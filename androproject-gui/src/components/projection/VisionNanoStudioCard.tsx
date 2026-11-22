// ============================================================================
// ARCHIVO: VisionNanoStudioCard.tsx
// QUÉ HACE: Tarjeta de configuración y lanzamiento del motor VisionNano 60 FPS
//           (resolución, FPS, bitrate, pantalla apagada, stay-awake, cámara).
// CÓMO FUNCIONA: Controla `scrcpyOptions` y dispara `onToggleScrcpy` cuando el
//           dispositivo es Android, bloqueando cambios mientras está activo.
// POR QUÉ: Desacoplar la UI de configuración de VisionNano mantiene
//           DeviceInfoPanel.tsx limpio y por debajo de 200 líneas (SRP).
// ============================================================================

'use client';

import React from 'react';
import { Play, Square, Sparkles, EyeOff, Sun, Maximize2, Layers, Camera, Zap } from 'lucide-react';
import type { ScrcpyOptions } from '@/hooks/useProjection';
import { ToggleRow } from './DeviceInfoPrimitives';

interface VisionNanoStudioCardProps {
  dark: boolean;
  cardStyle: string;
  scrcpyActive: boolean;
  isBusy: boolean;
  onToggleScrcpy: (opts?: Partial<ScrcpyOptions>) => void;
  scrcpyOptions: ScrcpyOptions;
  setScrcpyOptions: React.Dispatch<React.SetStateAction<ScrcpyOptions>>;
  autoProject: boolean;
  onToggleAutoProject?: (v: boolean) => void;
}

export const VisionNanoStudioCard: React.FC<VisionNanoStudioCardProps> = ({
  dark, cardStyle, scrcpyActive, isBusy, onToggleScrcpy,
  scrcpyOptions, setScrcpyOptions, autoProject, onToggleAutoProject,
}) => {
  const selectCls = `w-full py-1 px-1.5 rounded-lg text-[10px] font-medium border ${
    dark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'
  }`;
  const labelCls = `text-[10px] block font-medium mb-1 ${dark ? 'text-zinc-400' : 'text-slate-500'}`;

  return (
    <div className={`rounded-xl border p-3.5 ${cardStyle} space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-zinc-400" />
          <h3 className={`text-xs font-semibold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
            VisionNano Studio (Direct3D11 60 FPS)
          </h3>
        </div>
        {scrcpyActive && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-medium text-emerald-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Activo
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onToggleScrcpy()}
        disabled={isBusy}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer ${
          scrcpyActive
            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
            : 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold'
        }`}
      >
        {scrcpyActive ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
        <span>{scrcpyActive ? 'Detener VisionNano' : 'Lanzar VisionNano 60 FPS'}</span>
      </button>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <div>
          <label className={labelCls}>Resolución</label>
          <select
            value={scrcpyOptions.maxSize}
            onChange={(e) => setScrcpyOptions((o) => ({ ...o, maxSize: e.target.value }))}
            disabled={scrcpyActive}
            className={selectCls}
          >
            <option value="1080">1080p FHD</option>
            <option value="720">720p HD</option>
            <option value="480">480p</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Tasa FPS</label>
          <select
            value={scrcpyOptions.maxFps}
            onChange={(e) => setScrcpyOptions((o) => ({ ...o, maxFps: e.target.value }))}
            disabled={scrcpyActive}
            className={selectCls}
          >
            <option value="60">60 FPS</option>
            <option value="30">30 FPS</option>
            <option value="15">15 FPS</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Bitrate</label>
          <select
            value={scrcpyOptions.bitRate}
            onChange={(e) => setScrcpyOptions((o) => ({ ...o, bitRate: e.target.value }))}
            disabled={scrcpyActive}
            className={selectCls}
          >
            <option value="16M">16 Mbps</option>
            <option value="8M">8 Mbps</option>
            <option value="4M">4 Mbps</option>
            <option value="2M">2 Mbps</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5 pt-1">
        <ToggleRow
          dark={dark} icon={<EyeOff size={12} className="text-zinc-400" />}
          label="Apagar pantalla física al proyectar" description="Ahorra batería y temperatura"
          checked={scrcpyOptions.turnScreenOff} disabled={scrcpyActive}
          onChange={(checked) => setScrcpyOptions((o) => ({ ...o, turnScreenOff: checked }))}
        />
        <ToggleRow
          dark={dark} icon={<Sun size={12} className="text-zinc-400" />}
          label="Mantener pantalla activa" description="Evita que el teléfono entre en suspensión"
          checked={scrcpyOptions.stayAwake} disabled={scrcpyActive}
          onChange={(checked) => setScrcpyOptions((o) => ({ ...o, stayAwake: checked }))}
        />
        <ToggleRow
          dark={dark} icon={<Maximize2 size={12} className="text-zinc-400" />}
          label="Ventana siempre al frente" description="Fija la ventana encima de otras aplicaciones"
          checked={scrcpyOptions.alwaysOnTop} disabled={scrcpyActive}
          onChange={(checked) => setScrcpyOptions((o) => ({ ...o, alwaysOnTop: checked }))}
        />
        <ToggleRow
          dark={dark} icon={<Layers size={12} className="text-zinc-400" />}
          label="Ventana sin bordes" description="Elimina la barra de título para proyección edge-to-edge"
          checked={scrcpyOptions.borderless} disabled={scrcpyActive}
          onChange={(checked) => setScrcpyOptions((o) => ({ ...o, borderless: checked }))}
        />
        <ToggleRow
          dark={dark} icon={<Camera size={12} className="text-zinc-400" />}
          label="Transmitir Cámara Trasera" description="Usa el sensor de cámara en lugar de la pantalla"
          checked={scrcpyOptions.videoSource === 'camera'} disabled={scrcpyActive}
          onChange={(checked) => setScrcpyOptions((o) => ({ ...o, videoSource: checked ? 'camera' : 'display' }))}
        />
        {onToggleAutoProject && (
          <ToggleRow
            dark={dark} icon={<Zap size={12} className="text-zinc-400" />}
            label="Auto-proyectar al conectar" description="Inicia la ventana nativa scrcpy automáticamente"
            checked={autoProject} onChange={onToggleAutoProject}
          />
        )}
      </div>
    </div>
  );
};
