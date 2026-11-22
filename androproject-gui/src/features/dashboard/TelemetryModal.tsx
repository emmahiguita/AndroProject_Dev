// ============================================================================
// ARCHIVO: TelemetryModal.tsx
// QUÉ HACE: Ventana compacta de telemetría real del sistema con componentes
//           pequeños, medidores lineales exactos (0-100%), micro-histogramas
//           sin distorsión SVG, datos de kernel en vivo y botón de refresco.
// CÓMO FUNCIONA: Muestra CPU (delta /proc/stat + hilos activos), RAM (usada /
//           total + MB libres de /proc/meminfo), Temperatura (°C + mV de celda)
//           y Almacenamiento (bloques reales df -k /data) con actualización real.
// POR QUÉ: Proveer una ficha técnica compacta, profesional y 100% real (< 200L).
// ============================================================================
'use client';

import React from 'react';
import { Cpu, Activity, Thermometer, Database, BarChart3, RefreshCw, X } from 'lucide-react';
import type { DeviceInfo } from '../types';
import type { DeviceTelemetrySummary, TelemetryLevel } from './dashboard-helpers';

interface TelemetryModalProps {
  open: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  dark: boolean;
  device?: DeviceInfo | null;
  telemetry: DeviceTelemetrySummary;
  cpuHistory: number[];
  ramHistory: number[];
  tempHistory: number[];
  storHistory: number[];
}

/**
 * Componente pequeño de medidor técnico:
 * Cabecera compacta + barra de nivel de 6px + detalle real del kernel + micro-histograma.
 */
function MetricGaugeCard({
  dark, icon, label, value, percent, status, subDetail, level, history,
}: {
  dark: boolean;
  icon: React.ReactNode;
  label: string;
  value: string;
  percent: number;
  status: string;
  subDetail: string;
  level: TelemetryLevel;
  history: number[];
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const barFill = {
    ok: dark ? 'bg-emerald-500' : 'bg-emerald-600',
    warn: dark ? 'bg-amber-500' : 'bg-amber-600',
    crit: dark ? 'bg-red-500' : 'bg-red-600',
    neutral: dark ? 'bg-zinc-400' : 'bg-slate-600',
  }[level];
  const dotColor = {
    ok: 'bg-emerald-500',
    warn: 'bg-amber-500',
    crit: 'bg-red-500',
    neutral: dark ? 'bg-zinc-400' : 'bg-slate-500',
  }[level];
  const statusTextCls = {
    ok: dark ? 'text-emerald-400' : 'text-emerald-700',
    warn: dark ? 'text-amber-400' : 'text-amber-700',
    crit: dark ? 'text-red-400' : 'text-red-700',
    neutral: dark ? 'text-zinc-300' : 'text-slate-700',
  }[level];

  const samples = history.slice(-14);

  return (
    <div className={`rounded-md border p-2.5 flex flex-col justify-between gap-1.5 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}>
      {/* Fila 1: Etiqueta compacta e icono + valor numérico monoespaciado */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${dark ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-white border-slate-300 text-slate-700'}`}>
            {icon}
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${dark ? 'text-zinc-300' : 'text-slate-700'}`}>{label}</span>
        </div>
        <span className="text-sm font-mono font-bold tracking-tight shrink-0">{value}</span>
      </div>

      {/* Fila 2: Barra de nivel lineal de 6px (medidor exacto 0-100%) */}
      <div className={`w-full h-1.5 rounded-sm overflow-hidden border ${dark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-200 border-slate-300'}`}>
        <div className={`h-full transition-all duration-300 ${barFill}`} style={{ width: `${clamped}%` }} />
      </div>

      {/* Fila 3: Estado + detalle técnico real + micro-histograma vertical */}
      <div className="flex items-center justify-between gap-1.5 pt-0.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
            <span className={`text-[10px] font-semibold truncate ${statusTextCls}`}>{status}</span>
          </div>
          <p className={`text-[9px] font-mono truncate ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>{subDetail}</p>
        </div>
        <div className="flex items-end gap-0.5 h-3 shrink-0" title="Muestras reales en vivo">
          {samples.map((val, idx) => (
            <span
              key={idx}
              style={{ height: `${Math.min(100, Math.max(15, val))}%` }}
              className={`w-1 rounded-t-[1px] ${dark ? 'bg-zinc-600' : 'bg-slate-400'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Modal compacto de Telemetría Completa del Sistema. */
export const TelemetryModal: React.FC<TelemetryModalProps> = ({
  open, onClose, onRefresh, dark, device, telemetry, cpuHistory, ramHistory, tempHistory, storHistory,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-2.5 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl rounded-md border shadow-xl overflow-hidden ${dark ? 'bg-zinc-950 border-zinc-700 text-zinc-100' : 'bg-white border-slate-300 text-slate-900'}`}
      >
        {/* Barra de título compacta con botón de refresco en vivo y cierre */}
        <div className={`flex items-center justify-between px-3 py-2 border-b ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100 border-slate-300'}`}>
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className={dark ? 'text-zinc-300' : 'text-slate-700'} />
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider">Telemetría Real del Sistema</h3>
              <p className={`text-[9px] font-mono ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>
                /proc/stat · /proc/meminfo · df -k /data · dumpsys battery
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-semibold transition-colors ${dark ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-200'}`}
                title="Consultar sensores de Android ahora"
              >
                <RefreshCw size={11} /> <span>Leer</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`p-1 rounded border transition-colors ${dark ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-200'}`}
              title="Cerrar ventana"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Cuerpo compacto: Cuadrícula 2x2 de componentes pequeños + tabla de hardware */}
        <div className="p-3 space-y-2.5 max-h-[82vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <MetricGaugeCard dark={dark} icon={<Cpu size={12} />} label="CPU (Delta Real)" value={`${telemetry.cpuPercent}%`} percent={telemetry.cpuPercent} status={telemetry.cpuStatus} subDetail={telemetry.cpuSubDetail} level={telemetry.cpuLevel} history={cpuHistory} />
            <MetricGaugeCard dark={dark} icon={<Activity size={12} />} label="Memoria RAM" value={`${telemetry.ramPercent}%`} percent={telemetry.ramPercent} status={telemetry.ramStatus} subDetail={telemetry.ramSubDetail} level={telemetry.ramLevel} history={ramHistory} />
            <MetricGaugeCard dark={dark} icon={<Thermometer size={12} />} label="Temperatura" value={`${telemetry.tempCelsius}°C`} percent={Math.min(100, Math.round((telemetry.tempNum / 60) * 100))} status={telemetry.tempStatus} subDetail={telemetry.tempSubDetail} level={telemetry.tempLevel} history={tempHistory} />
            <MetricGaugeCard dark={dark} icon={<Database size={12} />} label="Almacenamiento" value={`${telemetry.storagePercent}%`} percent={telemetry.storagePercent} status={telemetry.storStatus} subDetail={telemetry.storSubDetail} level={telemetry.storLevel} history={storHistory} />
          </div>

          <div className={`grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-2 rounded border text-[11px] font-mono ${dark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
            <div><span className={`block text-[10px] uppercase ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Modelo</span><strong className="truncate block">{(device as { marketName?: string } | null)?.marketName || device?.model || '--'}</strong></div>
            <div><span className={`block text-[10px] uppercase ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Serial</span><strong className="truncate block">{device?.serial || '--'}</strong></div>
            <div><span className={`block text-[10px] uppercase ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Android</span><strong className="truncate block">{device?.androidVersion || '--'} ({device?.connectionType || 'USB'})</strong></div>
            <div><span className={`block text-[10px] uppercase ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Pantalla</span><strong className="truncate block">{device?.resolution || '--'}</strong></div>
            <div><span className={`block text-[10px] uppercase ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Uptime</span><strong className="truncate block">{device?.uptimeHours || '--'}</strong></div>
            <div><span className={`block text-[10px] uppercase ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Batería</span><strong className="truncate block">{device?.battery !== undefined ? `${device.battery}% ${device.isCharging ? '⚡' : ''}` : '--'}</strong></div>
          </div>
        </div>

        {/* Pie de ventana compacto */}
        <div className={`flex items-center justify-between px-3 py-2 border-t ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100 border-slate-300'}`}>
          <span className={`text-[9px] font-mono ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
            Boot: {device?.verifiedBootState || 'green'} · VBMeta: {device?.vbmetaState || 'locked'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-1 rounded border text-[11px] font-bold transition-colors ${dark ? 'bg-zinc-100 text-zinc-950 border-zinc-200 hover:bg-white' : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'}`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
