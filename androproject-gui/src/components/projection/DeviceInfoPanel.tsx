// ── DeviceInfoPanel — device details + controls ──────────────
// SRP: displays device information and action buttons.
// No stats grid — those are in Dashboard (avoids duplication).

'use client';

import React from 'react';
import {
  Battery, Clock, Play, Camera, Power, RotateCcw,
  ArrowLeft, Home, Layers, Volume2, VolumeX, Monitor,
  Cpu, Thermometer, Activity,
} from 'lucide-react';
import type { DeviceInfo } from '@/features/types';

interface DeviceInfoPanelProps {
  device: DeviceInfo;
  dark: boolean;
  scrcpyActive: boolean;
  onToggleScrcpy: () => void;
  onScreenshot: () => void;
  onPowerOff: () => void;
  onReboot: () => void;
  onGoBack: () => void;
  onGoHome: () => void;
  onOpenRecent: () => void;
  onVolumeUp: () => void;
  onVolumeDown: () => void;
}

export const DeviceInfoPanel: React.FC<DeviceInfoPanelProps> = ({
  device, dark, scrcpyActive,
  onToggleScrcpy, onScreenshot, onPowerOff, onReboot,
  onGoBack, onGoHome, onOpenRecent, onVolumeUp, onVolumeDown,
}) => {
  const cardBg = dark ? 'bg-white/[0.025]' : 'bg-white';
  const cardBorder = dark ? 'border-white/[0.07]' : 'border-slate-200';
  const cardShadow = dark ? '' : 'shadow-sm';

  // Parse temperature (handles both "34.0" °C and raw "340" tenths of °C)
  const parseTemp = (t?: string) => {
    if (!t || t === '--') return '--';
    let val = parseFloat(t);
    if (isNaN(val)) return '--';
    if (val > 100) val = val / 10;
    return val.toFixed(0);
  };
  const tempCelsius = parseTemp(device.temperature);

  return (
    <div className="p-2 space-y-2">
      {/* ═══ Quick Stats — compact inline from device data ═══ */}
      <div className="grid grid-cols-4 gap-1">
        <MiniStat
          dark={dark}
          icon={<Battery size={10} className="text-green-500" />}
          value={`${device.battery ?? '--'}%`}
        />
        <MiniStat
          dark={dark}
          icon={<Cpu size={10} className="text-blue-500" />}
          value={`${device.cpuUsagePercent ?? 0}%`}
        />
        <MiniStat
          dark={dark}
          icon={<Thermometer size={10} className="text-orange-500" />}
          value={tempCelsius !== '--' ? `${tempCelsius}°` : '--'}
        />
        <MiniStat
          dark={dark}
          icon={<Activity size={10} className="text-purple-500" />}
          value={`${device.ramUsagePercent ?? 0}%`}
        />
      </div>

      {/* ═══ Device Details ═══ */}
      <div className={`rounded-xl border p-2.5 ${cardBg} ${cardBorder} ${cardShadow}`}>
        <h3 className={`text-[10px] font-bold mb-2 uppercase tracking-wider ${dark ? 'text-white/50' : 'text-slate-400'}`}>
          Dispositivo
        </h3>
        <div className="space-y-1.5">
          <DetailRow dark={dark} label="Modelo" value={device.model || '--'} />
          <DetailRow dark={dark} label="Serial" value={device.serial || '--'} mono />
          <DetailRow dark={dark} label="Android" value={device.androidVersion || '--'} />
          <DetailRow dark={dark} label="Resolución" value={device.resolution || '--'} />
          <DetailRow dark={dark} label="Conexión" value={device.connectionType || 'USB'} />
          <DetailRow dark={dark} label="Almacenamiento" value={
            device.storageFreeGB ? `${device.storageFreeGB} GB libres` : '--'
          } />
        </div>
      </div>

      {/* ═══ Navigation Controls ═══ */}
      <div className={`rounded-xl border p-2.5 ${cardBg} ${cardBorder} ${cardShadow}`}>
        <h3 className={`text-[10px] font-bold mb-2 uppercase tracking-wider ${dark ? 'text-white/50' : 'text-slate-400'}`}>
          Navegación
        </h3>
        <div className="grid grid-cols-3 gap-1">
          <NavBtn dark={dark} icon={<ArrowLeft size={14} />} label="Atrás" onClick={onGoBack} />
          <NavBtn dark={dark} icon={<Home size={14} />} label="Inicio" onClick={onGoHome} primary />
          <NavBtn dark={dark} icon={<Layers size={14} />} label="Recientes" onClick={onOpenRecent} />
        </div>
        <div className="grid grid-cols-2 gap-1 mt-1">
          <NavBtn dark={dark} icon={<VolumeX size={14} />} label="Vol-" onClick={onVolumeDown} />
          <NavBtn dark={dark} icon={<Volume2 size={14} />} label="Vol+" onClick={onVolumeUp} />
        </div>
      </div>

      {/* ═══ Quick Actions ═══ */}
      <div className={`rounded-xl border p-2.5 ${cardBg} ${cardBorder} ${cardShadow}`}>
        <h3 className={`text-[10px] font-bold mb-2 uppercase tracking-wider ${dark ? 'text-white/50' : 'text-slate-400'}`}>
          Acciones
        </h3>
        <div className="space-y-1">
          <ActionBtn
            dark={dark}
            icon={scrcpyActive ? <Monitor size={11} /> : <Play size={11} />}
            label={scrcpyActive ? 'scrcpy activo' : 'Iniciar scrcpy'}
            onClick={onToggleScrcpy}
            active={scrcpyActive}
          />
          <ActionBtn dark={dark} icon={<Camera size={11} />} label="Captura" onClick={onScreenshot} />
          <ActionBtn dark={dark} icon={<RotateCcw size={11} />} label="Reiniciar" onClick={onReboot} />
          <ActionBtn dark={dark} icon={<Power size={11} />} label="Apagar" onClick={onPowerOff} danger />
        </div>
      </div>
    </div>
  );
};

/* ── MiniStat — compact inline stat ──────────────────────── */
function MiniStat({ dark, icon, value }: {
  dark: boolean; icon: React.ReactNode; value: string;
}) {
  return (
    <div className={`flex items-center gap-1 px-1.5 py-1 rounded-lg ${
      dark ? 'bg-white/[0.03] border border-white/5' : 'bg-slate-50 border border-slate-200'
    }`}>
      {icon}
      <span className={`text-[9px] font-bold ${dark ? 'text-white/60' : 'text-slate-600'}`}>{value}</span>
    </div>
  );
}

/* ── DetailRow ──────────────────────────────────────────── */
function DetailRow({ dark, label, value, mono }: {
  dark: boolean; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span className={`text-[9px] shrink-0 ${dark ? 'text-white/40' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-[9px] font-semibold truncate ${mono ? 'font-mono' : ''} ${dark ? 'text-white/70' : 'text-slate-700'}`}>
        {value}
      </span>
    </div>
  );
}

/* ── NavBtn ─────────────────────────────────────────────── */
function NavBtn({ dark, icon, label, onClick, primary }: {
  dark: boolean; icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all text-[9px] font-semibold ${
        primary
          ? dark
            ? 'bg-[#1bae6e]/15 text-[#22c97d] border border-[#1bae6e]/25 hover:bg-[#1bae6e]/25'
            : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
          : dark
            ? 'bg-white/[0.03] text-white/50 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white/70'
            : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-slate-700'
      }`}
      title={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ── ActionBtn ──────────────────────────────────────────── */
function ActionBtn({ dark, icon, label, onClick, active, danger }: {
  dark: boolean; icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all text-[10px] font-semibold ${
        danger
          ? dark
            ? 'text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/30'
            : 'text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300'
          : active
            ? dark
              ? 'text-green-400 bg-green-500/10 border border-green-500/20'
              : 'text-green-600 bg-green-50 border border-green-200'
            : dark
              ? 'text-white/60 hover:bg-white/5 border border-white/[0.06] hover:border-white/10'
              : 'text-slate-600 hover:bg-slate-50 border border-slate-200 hover:border-slate-300'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
