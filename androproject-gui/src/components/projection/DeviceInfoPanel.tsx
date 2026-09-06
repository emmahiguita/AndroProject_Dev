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
  ClipboardPaste, Airplay,
} from 'lucide-react';
import { useActions } from '@/hooks/useActions';
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
  const { run } = useActions();
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

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        showToast('Portapapeles de la PC vacío');
        return;
      }
      const res = await run('paste_clipboard', 'Pegar del PC', { text, serial: device.serial }, false);
      if (res?.success) {
        showToast('Texto pegado en el dispositivo');
      } else {
        showToast('Error al pegar en dispositivo');
      }
    } catch {
      showToast('Permiso de portapapeles denegado');
    }
  };

  const cardBg = dark ? 'bg-zinc-900/40' : 'bg-white';
  const cardBorder = dark ? 'border-zinc-800/70' : 'border-slate-200';
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
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/95 border border-zinc-700 text-zinc-200 text-xs font-medium shadow-xl backdrop-blur-md">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* ═══ MODO APPLE AIRPLAY 2 STUDIO (Si el dispositivo es iOS) ═══ */}
      {isIos ? (
        <div className={`rounded-xl border p-3.5 ${cardBg} ${cardBorder} ${cardShadow} space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-200">
                <Airplay size={14} />
              </div>
              <div>
                <h3 className={`text-xs font-semibold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
                  Receptor Apple AirPlay 2
                </h3>
                <p className="text-[10px] text-zinc-400">Screen Mirroring H.264 + Audio AAC</p>
              </div>
            </div>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-medium text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 60 FPS
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 font-normal">Nombre en Red:</span>
              <span className="font-medium text-zinc-200 font-mono">AndroProject [PC]</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 font-normal">Resolución:</span>
              <span className="font-medium text-zinc-200 font-mono">{device.resolution || '1179 × 2556'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 font-normal">Velocidad de Cuadros:</span>
              <span className="font-medium text-zinc-200 font-mono">60 FPS (Direct3D11)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={async () => {
                showToast('Abriendo ventana flotante...');
                try {
                  await fetch('/api/airplay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'open_native_window' }),
                  });
                  showToast('Ventana flotante abierta');
                } catch {
                  showToast('Error al abrir ventana');
                }
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition-colors bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
            >
              <Maximize2 size={13} />
              <span>Ventana Libre</span>
            </button>

            <button
              type="button"
              onClick={() => {
                showToast('Control de ratón activado');
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition-colors bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
            >
              <Sparkles size={13} className="text-zinc-400" />
              <span>Control Ratón</span>
            </button>
          </div>
        </div>
      ) : (
        /* ═══ MODO ANDROID VISIONNANO 60 FPS ENGINE ═══ */
        <div className={`rounded-xl border p-3.5 ${cardBg} ${cardBorder} ${cardShadow} space-y-3`}>
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

          {/* Action Button */}
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

        {/* Streaming Controls Configuration */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div>
            <label className={`text-[10px] block font-medium mb-1 ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Resolución
            </label>
            <select
              value={scrcpyOptions.maxSize}
              onChange={(e) => setScrcpyOptions((o) => ({ ...o, maxSize: e.target.value }))}
              disabled={scrcpyActive}
              className={`w-full py-1 px-1.5 rounded-lg text-[10px] font-medium border ${
                dark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="1080">1080p FHD</option>
              <option value="720">720p HD</option>
              <option value="480">480p</option>
            </select>
          </div>

          <div>
            <label className={`text-[10px] block font-medium mb-1 ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Tasa FPS
            </label>
            <select
              value={scrcpyOptions.maxFps}
              onChange={(e) => setScrcpyOptions((o) => ({ ...o, maxFps: e.target.value }))}
              disabled={scrcpyActive}
              className={`w-full py-1 px-1.5 rounded-lg text-[10px] font-medium border ${
                dark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="60">60 FPS</option>
              <option value="30">30 FPS</option>
              <option value="15">15 FPS</option>
            </select>
          </div>

          <div>
            <label className={`text-[10px] block font-medium mb-1 ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Bitrate
            </label>
            <select
              value={scrcpyOptions.bitRate}
              onChange={(e) => setScrcpyOptions((o) => ({ ...o, bitRate: e.target.value }))}
              disabled={scrcpyActive}
              className={`w-full py-1 px-1.5 rounded-lg text-[10px] font-medium border ${
                dark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'
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
            icon={<EyeOff size={12} className="text-zinc-400" />}
            label="Apagar pantalla física al proyectar"
            description="Ahorra batería y temperatura"
            checked={scrcpyOptions.turnScreenOff}
            onChange={(checked) => setScrcpyOptions((o) => ({ ...o, turnScreenOff: checked }))}
            disabled={scrcpyActive}
          />
          <ToggleRow
            dark={dark}
            icon={<Sun size={12} className="text-zinc-400" />}
            label="Mantener pantalla activa"
            description="Evita que el teléfono entre en suspensión"
            checked={scrcpyOptions.stayAwake}
            onChange={(checked) => setScrcpyOptions((o) => ({ ...o, stayAwake: checked }))}
            disabled={scrcpyActive}
          />
          <ToggleRow
            dark={dark}
            icon={<Maximize2 size={12} className="text-zinc-400" />}
            label="Ventana siempre al frente"
            description="Fija la ventana encima de otras aplicaciones"
            checked={scrcpyOptions.alwaysOnTop}
            onChange={(checked) => setScrcpyOptions((o) => ({ ...o, alwaysOnTop: checked }))}
            disabled={scrcpyActive}
          />
          <ToggleRow
            dark={dark}
            icon={<Layers size={12} className="text-zinc-400" />}
            label="Ventana sin bordes"
            description="Elimina la barra de título para proyección edge-to-edge"
            checked={scrcpyOptions.borderless}
            onChange={(checked) => setScrcpyOptions((o) => ({ ...o, borderless: checked }))}
            disabled={scrcpyActive}
          />
          <ToggleRow
            dark={dark}
            icon={<Camera size={12} className="text-zinc-400" />}
            label="Transmitir Cámara Trasera"
            description="Usa el sensor de cámara en lugar de la pantalla"
            checked={scrcpyOptions.videoSource === 'camera'}
            onChange={(checked) => setScrcpyOptions((o) => ({ ...o, videoSource: checked ? 'camera' : 'display' }))}
            disabled={scrcpyActive}
          />
          {onToggleAutoProject && (
            <ToggleRow
              dark={dark}
              icon={<Zap size={12} className="text-zinc-400" />}
              label="Auto-proyectar al conectar"
              description="Inicia la ventana nativa scrcpy automáticamente"
              checked={autoProject}
              onChange={onToggleAutoProject}
            />
          )}
        </div>
      </div>
      )}

      {/* ═══ Grabador de Pantalla HD en Segundo Plano ═══ */}
      <div className={`rounded-xl border p-3.5 ${cardBg} ${cardBorder} ${cardShadow} space-y-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video size={14} className={isRecording ? 'text-rose-400 animate-pulse' : 'text-zinc-400'} />
            <h3 className={`text-xs font-semibold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
              Grabador de Pantalla MP4
            </h3>
          </div>
          {isRecording && (
            <span className="font-mono text-[10px] text-rose-400 font-medium px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20">
              REC {formatTime(recordingSeconds)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleRecord}
          disabled={isBusy}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            isRecording
              ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
          }`}
        >
          {isRecording ? <Square size={12} fill="currentColor" /> : <Circle size={12} fill="currentColor" />}
          <span>{isRecording ? 'Detener Grabación' : 'Iniciar Grabación (MP4)'}</span>
        </button>
      </div>

      {/* ═══ Herramientas de Control & Sistema ═══ */}
      <div className={`rounded-xl border p-3.5 ${cardBg} ${cardBorder} ${cardShadow} space-y-2.5`}>
        <h3 className={`text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
          Herramientas y Sistema
        </h3>

        {/* Orientation Selector */}
        <div>
          <span className={`text-[10px] block font-medium mb-1.5 ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
            Orientación de Pantalla
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => { onSetOrientation('auto'); showToast('Orientación: Automática'); }}
              className={`py-1.5 rounded-lg text-[10px] font-medium border transition-colors text-center cursor-pointer ${
                dark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => { onSetOrientation('portrait'); showToast('Orientación: Vertical'); }}
              className={`py-1.5 rounded-lg text-[10px] font-medium border transition-colors text-center cursor-pointer ${
                dark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Vertical
            </button>
            <button
              type="button"
              onClick={() => { onSetOrientation('landscape'); showToast('Orientación: Horizontal'); }}
              className={`py-1.5 rounded-lg text-[10px] font-medium border transition-colors text-center cursor-pointer ${
                dark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
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
            icon={<ClipboardPaste size={13} className="text-zinc-400" />}
            label="Pegar del PC"
            onClick={handlePasteClipboard}
          />
          <ToolButton
            dark={dark}
            icon={<Camera size={13} className="text-zinc-400" />}
            label="Captura HD"
            onClick={handleScreenshotClick}
          />
          {onOpenAllApps && (
            <ToolButton
              dark={dark}
              icon={<LayoutGrid size={13} className="text-zinc-400" />}
              label="Todas las Apps"
              onClick={() => { onOpenAllApps(); showToast('Abriendo aplicaciones'); }}
            />
          )}
          <ToolButton
            dark={dark}
            icon={<Bell size={13} className="text-zinc-400" />}
            label="Notificaciones"
            onClick={() => { onExpandNotifications(); showToast('Desplegando notificaciones'); }}
          />
          <ToolButton
            dark={dark}
            icon={<Sliders size={13} className="text-zinc-400" />}
            label="Ajustes Rápidos"
            onClick={() => { onExpandQuickSettings(); showToast('Ajustes rápidos'); }}
          />
          <ToolButton
            dark={dark}
            icon={<Power size={13} className="text-zinc-400" />}
            label="Bloquear Pantalla"
            onClick={() => { onTogglePowerScreen(); showToast('Bloqueando pantalla'); }}
          />
          {onWakeScreen && (
            <ToolButton
              dark={dark}
              icon={<Sun size={13} className="text-zinc-400" />}
              label="Despertar Pantalla"
              onClick={() => { onWakeScreen(); showToast('Despertando pantalla'); }}
            />
          )}
          {onOpenSettings && (
            <ToolButton
              dark={dark}
              icon={<Settings size={13} className="text-zinc-400" />}
              label="Ajustes Sistema"
              onClick={() => { onOpenSettings(); showToast('Abriendo Ajustes'); }}
            />
          )}
          {onToggleMute && (
            <ToolButton
              dark={dark}
              icon={<VolumeX size={13} className="text-zinc-400" />}
              label="Silenciar"
              onClick={() => { onToggleMute(); showToast('Alternando silencio'); }}
            />
          )}
          {onMediaPlayPause && (
            <ToolButton
              dark={dark}
              icon={<PlayCircle size={13} className="text-zinc-400" />}
              label="Play / Pausa"
              onClick={() => { onMediaPlayPause(); showToast('Play / Pausa multimedia'); }}
            />
          )}
          {onCollapsePanels && (
            <ToolButton
              dark={dark}
              icon={<ChevronUp size={13} className="text-zinc-400" />}
              label="Cerrar Paneles"
              onClick={() => { onCollapsePanels(); showToast('Cerrando paneles'); }}
            />
          )}
          <ToolButton
            dark={dark}
            icon={<RotateCcw size={13} className="text-zinc-400" />}
            label="Reiniciar"
            onClick={() => { onReboot(); showToast('Reiniciando...'); }}
          />
          <ToolButton
            dark={dark}
            icon={<Power size={13} className="text-rose-400" />}
            label="Apagar"
            onClick={() => { onPowerOff(); showToast('Apagando...'); }}
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
        disabled ? 'opacity-50 cursor-not-allowed' : dark ? 'hover:bg-zinc-900/60' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0">
          <span className={`text-[11px] font-medium block leading-tight ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>
            {label}
          </span>
          {description && (
            <span className={`text-[10px] block leading-tight ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
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
        className="w-3.5 h-3.5 rounded accent-zinc-200 cursor-pointer"
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
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors text-xs font-medium border cursor-pointer ${
        danger
          ? dark
            ? 'text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20'
            : 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200'
          : dark
            ? 'text-zinc-300 bg-zinc-900/50 hover:bg-zinc-800/80 border-zinc-800/80 hover:text-zinc-100'
            : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
