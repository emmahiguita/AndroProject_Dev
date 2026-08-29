// ── DeviceInfoPanel — Projection Engine & Studio Control Hub ──────────────
// Single authoritative Scrcpy 60 FPS studio controller,
// MP4 video recorder, screen orientation selector, and quick system tools.

'use client';

import React, { useState } from 'react';
import {
  Play, Square, Video, Camera, Power, RotateCcw,
  Sliders, Bell, Zap, EyeOff,
  Sun, Maximize2, Sparkles, Circle, LayoutGrid,
  CheckCircle2, Settings, VolumeX, PlayCircle, ChevronUp, Layers,
} from 'lucide-react';
import type { DeviceInfo } from '@/features/types';
import type { ScrcpyOptions } from '@/hooks/useProjection';

interface DeviceInfoPanelProps {
  device: DeviceInfo;
  dark: boolean;
  scrcpyActive: boolean;
  onToggleScrcpy: (opts?: Partial<ScrcpyOptions>) => void;
  scrcpyOptions: ScrcpyOptions;
  setScrcpyOptions: React.Dispatch<React.SetStateAction<ScrcpyOptions>>;
  isRecording: boolean;
  recordingSeconds: number;
  onToggleRecord: () => void;
  onScreenshot: () => Promise<string | null> | void;
  onPowerOff: () => void;
  onReboot: () => void;
  onTogglePowerScreen: () => void;
  onWakeScreen?: () => void;
  onOpenAllApps?: () => void;
  onToggleMute?: () => void;
  onMediaPlayPause?: () => void;
  onOpenSettings?: () => void;
  onCollapsePanels?: () => void;
  onExpandNotifications: () => void;
  onExpandQuickSettings: () => void;
  onSetOrientation: (mode: 'auto' | 'portrait' | 'landscape') => void;
  isBusy: boolean;
  onConnectAdb?: (ip: string, port?: string) => Promise<{ success: boolean; message?: string }>;
  isConnecting?: boolean;
  autoProject?: boolean;
  onToggleAutoProject?: (v: boolean) => void;
}

export const DeviceInfoPanel: React.FC<DeviceInfoPanelProps> = ({
  device,
  dark,
  scrcpyActive,
  onToggleScrcpy,
  scrcpyOptions,
  setScrcpyOptions,
  isRecording,
  recordingSeconds,
  onToggleRecord,
  onScreenshot,
  onPowerOff,
  onReboot,
  onTogglePowerScreen,
  onWakeScreen,
  onOpenAllApps,
  onToggleMute,
  onMediaPlayPause,
  onOpenSettings,
  onCollapsePanels,
  onExpandNotifications,
  onExpandQuickSettings,
  onSetOrientation,
  isBusy,
  autoProject = false,
  onToggleAutoProject,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleScreenshotClick = async () => {
    showToast('Capturando pantalla HD...');
    const path = await onScreenshot();
    if (path) {
      showToast('Captura guardada en Capturas');
    }
  };

  const cardBg = dark ? 'bg-white/[0.025]' : 'bg-white';
  const cardBorder = dark ? 'border-white/[0.07]' : 'border-slate-200';
  const cardShadow = dark ? '' : 'shadow-sm';

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isIos = device.platform === 'ios' || device.serial?.startsWith('airplay-');

  return (
    <div className="p-3 space-y-3 relative">
      {/* Toast notification overlay */}
      {toastMessage && (
        <div className="sticky top-2 z-30 flex items-center justify-center animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/90 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-xl">
            <CheckCircle2 size={13} />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* ═══ MODO APPLE AIRPLAY 2 STUDIO (Si el dispositivo es iOS) ═══ */}
      {isIos ? (
        <div className={`rounded-xl border p-3.5 ${cardBg} ${cardBorder} ${cardShadow} space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🍏</span>
              <div>
                <h3 className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
                  Receptor Apple AirPlay 2
                </h3>
                <p className="text-[10px] text-white/50">Screen Mirroring H.264 + Audio Sincronizado</p>
              </div>
            </div>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00e5ff]/10 border border-[#00e5ff]/30 text-[9px] font-bold text-[#00e5ff] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-pulse" /> AIRPLAY 60 FPS
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/60 font-medium">Nombre en Red (Bonjour):</span>
              <span className="font-bold text-white font-mono">AndroProject [PC]</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/60 font-medium">Resolución de Flujo:</span>
              <span className="font-bold text-white font-mono">{device.resolution || '1179 × 2556'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/60 font-medium">Velocidad de Cuadros:</span>
              <span className="font-bold text-emerald-400 font-mono">60 FPS (GPU Direct3D)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/60 font-medium">Audio AirPlay:</span>
              <span className="font-bold text-emerald-400">Activado (AAC-ELD)</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#00e5ff]/5 border border-[#00e5ff]/20 text-[11px] text-white/80 space-y-1.5">
            <div className="font-bold text-[#00e5ff] flex items-center gap-1">
              <span>📱 Cómo conectar tu iPhone / iPad:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[10px] text-white/70">
              <li>Abre el <strong>Centro de Control</strong> deslizando hacia abajo.</li>
              <li>Toca el icono de <strong>Duplicar Pantalla</strong>.</li>
              <li>Selecciona <strong>AndroProject [PC]</strong> de la lista.</li>
              <li>La pantalla y el audio se proyectarán en vivo en este marco.</li>
            </ol>
          </div>
        </div>
      ) : (
        /* ═══ MODO ANDROID VISIONNANO 60 FPS ENGINE ═══ */
        <div className={`rounded-xl border p-3 ${cardBg} ${cardBorder} ${cardShadow} space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#22c97d]" />
              <h3 className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
                VisionNano Engine (Direct3D11 60 FPS)
              </h3>
            </div>
            {scrcpyActive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> VISIONNANO ACTIVO
              </span>
            )}
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={() => onToggleScrcpy()}
            disabled={isBusy}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
              scrcpyActive
                ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30'
                : 'bg-[#1bae6e] hover:bg-[#22c97d] text-white shadow-[#1bae6e]/20 active:scale-[0.98]'
            }`}
          >
            {scrcpyActive ? <Square size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
            <span>{scrcpyActive ? 'Detener VisionNano 60 FPS' : 'Lanzar VisionNano 60 FPS (Direct3D11)'}</span>
          </button>

        {/* Streaming Controls Configuration */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div>
            <label className={`text-[10px] block font-semibold mb-1 ${dark ? 'text-white/50' : 'text-slate-500'}`}>
              Resolución
            </label>
            <select
              value={scrcpyOptions.maxSize}
              onChange={(e) => setScrcpyOptions((o) => ({ ...o, maxSize: e.target.value }))}
              disabled={scrcpyActive}
              className={`w-full py-1 px-1.5 rounded-lg text-[10px] font-medium border ${
                dark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="1920">FHD (1080p)</option>
              <option value="1280">HD (720p)</option>
              <option value="800">SD (480p)</option>
              <option value="0">Nativo Max</option>
            </select>
          </div>

          <div>
            <label className={`text-[10px] block font-semibold mb-1 ${dark ? 'text-white/50' : 'text-slate-500'}`}>
              Tasa FPS
            </label>
            <select
              value={scrcpyOptions.maxFps}
              onChange={(e) => setScrcpyOptions((o) => ({ ...o, maxFps: e.target.value }))}
              disabled={scrcpyActive}
              className={`w-full py-1 px-1.5 rounded-lg text-[10px] font-medium border ${
                dark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="60">60 FPS</option>
              <option value="30">30 FPS</option>
              <option value="15">15 FPS</option>
            </select>
          </div>

          <div>
            <label className={`text-[10px] block font-semibold mb-1 ${dark ? 'text-white/50' : 'text-slate-500'}`}>
              Bitrate
            </label>
            <select
              value={scrcpyOptions.bitRate}
              onChange={(e) => setScrcpyOptions((o) => ({ ...o, bitRate: e.target.value }))}
              disabled={scrcpyActive}
              className={`w-full py-1 px-1.5 rounded-lg text-[10px] font-medium border ${
                dark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="16M">16 Mbps</option>
              <option value="8M">8 Mbps</option>
              <option value="4M">4 Mbps</option>
              <option value="2M">2 Mbps</option>
            </select>
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-1.5 pt-1">
          <ToggleRow
            dark={dark}
            icon={<EyeOff size={11} className="text-amber-400" />}
            label="Apagar pantalla física al proyectar"
            description="Ahorra batería y evita sobrecalentamiento"
            checked={scrcpyOptions.turnScreenOff}
            onChange={(checked) => setScrcpyOptions((o) => ({ ...o, turnScreenOff: checked }))}
            disabled={scrcpyActive}
          />
          <ToggleRow
            dark={dark}
            icon={<Sun size={11} className="text-yellow-400" />}
            label="Mantener pantalla activa"
            description="Evita que el dispositivo entre en suspensión"
            checked={scrcpyOptions.stayAwake}
            onChange={(checked) => setScrcpyOptions((o) => ({ ...o, stayAwake: checked }))}
            disabled={scrcpyActive}
          />
          <ToggleRow
            dark={dark}
            icon={<Maximize2 size={11} className="text-sky-400" />}
            label="Ventana siempre al frente"
            description="Mantiene la ventana de scrcpy fija encima"
            checked={scrcpyOptions.alwaysOnTop}
            onChange={(checked) => setScrcpyOptions((o) => ({ ...o, alwaysOnTop: checked }))}
            disabled={scrcpyActive}
          />
          <ToggleRow
            dark={dark}
            icon={<Layers size={11} className="text-[#00e5ff]" />}
            label="Ventana Cibernética Sin Bordes (Borderless)"
            description="Elimina la barra clásica de Windows para proyección pura edge-to-edge"
            checked={scrcpyOptions.borderless}
            onChange={(checked) => setScrcpyOptions((o) => ({ ...o, borderless: checked }))}
            disabled={scrcpyActive}
          />
          <ToggleRow
            dark={dark}
            icon={<Camera size={11} className="text-emerald-400" />}
            label="Transmitir Cámara Trasera"
            description="Usa el sensor de cámara en lugar de la pantalla"
            checked={scrcpyOptions.videoSource === 'camera'}
            onChange={(checked) => setScrcpyOptions((o) => ({ ...o, videoSource: checked ? 'camera' : 'display' }))}
            disabled={scrcpyActive}
          />
          {onToggleAutoProject && (
            <ToggleRow
              dark={dark}
              icon={<Zap size={11} className="text-[#22c97d]" />}
              label="Auto-proyectar al detectar dispositivo"
              description="Inicia la ventana nativa scrcpy automáticamente"
              checked={autoProject}
              onChange={onToggleAutoProject}
            />
          )}
        </div>
      </div>
      )}

      {/* ═══ Grabador de Pantalla HD en Segundo Plano ═══ */}
      <div className={`rounded-xl border p-3 ${cardBg} ${cardBorder} ${cardShadow} space-y-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Video size={14} className={isRecording ? 'text-red-400 animate-pulse' : 'text-purple-400'} />
            <h3 className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
              Grabador de Pantalla MP4
            </h3>
          </div>
          {isRecording && (
            <span className="font-mono text-[10px] text-red-400 font-bold px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
              REC {formatTime(recordingSeconds)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleRecord}
          disabled={isBusy}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'
              : dark
                ? 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/30'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
          }`}
        >
          {isRecording ? <Square size={12} fill="currentColor" /> : <Circle size={12} fill="currentColor" />}
          <span>{isRecording ? 'Detener y Guardar Grabación' : 'Iniciar Grabación HD (H.265)'}</span>
        </button>
      </div>

      {/* ═══ Herramientas de Control & Sistema ═══ */}
      <div className={`rounded-xl border p-3 ${cardBg} ${cardBorder} ${cardShadow} space-y-2.5`}>
        <h3 className={`text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-slate-400'}`}>
          Herramientas y Sistema
        </h3>

        {/* Orientation Selector */}
        <div>
          <span className={`text-[10px] block font-semibold mb-1 ${dark ? 'text-white/50' : 'text-slate-500'}`}>
            Orientación de Pantalla
          </span>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => { onSetOrientation('auto'); showToast('Orientación: Automática'); }}
              className={`py-1.5 rounded-lg text-[10px] font-semibold border transition-all text-center ${
                dark ? 'bg-white/[0.03] border-white/5 text-white/70 hover:bg-white/[0.08]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => { onSetOrientation('portrait'); showToast('Orientación: Vertical fija'); }}
              className={`py-1.5 rounded-lg text-[10px] font-semibold border transition-all text-center ${
                dark ? 'bg-white/[0.03] border-white/5 text-white/70 hover:bg-white/[0.08]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Vertical
            </button>
            <button
              type="button"
              onClick={() => { onSetOrientation('landscape'); showToast('Orientación: Horizontal fija'); }}
              className={`py-1.5 rounded-lg text-[10px] font-semibold border transition-all text-center ${
                dark ? 'bg-white/[0.03] border-white/5 text-white/70 hover:bg-white/[0.08]' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Horizontal
            </button>
          </div>
        </div>

        {/* Quick System Buttons Grid */}
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <ToolButton
            dark={dark}
            icon={<Camera size={12} className="text-emerald-400" />}
            label="Captura HD"
            onClick={handleScreenshotClick}
          />
          {onOpenAllApps && (
            <ToolButton
              dark={dark}
              icon={<LayoutGrid size={12} className="text-emerald-400" />}
              label="Todas las Apps"
              onClick={() => { onOpenAllApps(); showToast('Abriendo menú de aplicaciones'); }}
            />
          )}
          <ToolButton
            dark={dark}
            icon={<Bell size={12} className="text-sky-400" />}
            label="Notificaciones"
            onClick={() => { onExpandNotifications(); showToast('Desplegando notificaciones'); }}
          />
          <ToolButton
            dark={dark}
            icon={<Sliders size={12} className="text-violet-400" />}
            label="Ajustes Rápidos"
            onClick={() => { onExpandQuickSettings(); showToast('Desplegando ajustes rápidos'); }}
          />
          <ToolButton
            dark={dark}
            icon={<Power size={12} className="text-amber-400" />}
            label="Bloquear Pantalla"
            onClick={() => { onTogglePowerScreen(); showToast('Bloqueando pantalla'); }}
          />
          {onWakeScreen && (
            <ToolButton
              dark={dark}
              icon={<Sun size={12} className="text-yellow-400" />}
              label="Despertar Pantalla"
              onClick={() => { onWakeScreen(); showToast('Despertando pantalla'); }}
            />
          )}
          {onOpenSettings && (
            <ToolButton
              dark={dark}
              icon={<Settings size={12} className="text-slate-300" />}
              label="Ajustes Sistema"
              onClick={() => { onOpenSettings(); showToast('Abriendo Ajustes de Android'); }}
            />
          )}
          {onToggleMute && (
            <ToolButton
              dark={dark}
              icon={<VolumeX size={12} className="text-amber-400" />}
              label="Silenciar"
              onClick={() => { onToggleMute(); showToast('Alternando Silencio'); }}
            />
          )}
          {onMediaPlayPause && (
            <ToolButton
              dark={dark}
              icon={<PlayCircle size={12} className="text-[#22c97d]" />}
              label="Play / Pausa"
              onClick={() => { onMediaPlayPause(); showToast('Play / Pausa multimedia'); }}
            />
          )}
          {onCollapsePanels && (
            <ToolButton
              dark={dark}
              icon={<ChevronUp size={12} className="text-sky-300" />}
              label="Cerrar Paneles"
              onClick={() => { onCollapsePanels(); showToast('Cerrando paneles desplegados'); }}
            />
          )}
          <ToolButton
            dark={dark}
            icon={<RotateCcw size={12} className="text-blue-400" />}
            label="Reiniciar"
            onClick={() => { onReboot(); showToast('Enviando orden de reinicio...'); }}
          />
          <ToolButton
            dark={dark}
            icon={<Power size={12} className="text-red-400" />}
            label="Apagar"
            onClick={() => { onPowerOff(); showToast('Enviando orden de apagado...'); }}
            danger
          />
        </div>
      </div>
    </div>
  );
};

/* ── ToggleRow Subcomponent ──────────────────────────── */
function ToggleRow({
  dark,
  icon,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  dark: boolean;
  icon: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer select-none transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0">
          <span className={`text-[10px] font-semibold block leading-tight ${dark ? 'text-white/80' : 'text-slate-800'}`}>
            {label}
          </span>
          {description && (
            <span className={`text-[9px] block leading-tight ${dark ? 'text-white/40' : 'text-slate-400'}`}>
              {description}
            </span>
          )}
        </div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded accent-[#22c97d] cursor-pointer"
      />
    </label>
  );
}

/* ── ToolButton Subcomponent ──────────────────────────── */
function ToolButton({
  dark,
  icon,
  label,
  onClick,
  danger,
}: {
  dark: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all text-[10px] font-semibold border ${
        danger
          ? dark
            ? 'text-red-400 bg-red-500/5 hover:bg-red-500/15 border-red-500/20'
            : 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200'
          : dark
            ? 'text-white/70 bg-white/[0.02] hover:bg-white/[0.06] border-white/5 hover:text-white'
            : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
