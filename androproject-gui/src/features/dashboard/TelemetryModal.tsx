// ============================================================================
// ARCHIVO: TelemetryModal.tsx
// QUÉ HACE: Ventana modal de telemetría del sistema con estilo de utilidad
//           técnica limpia (barras de nivel precisas, micro-histograma sin
//           deformación SVG y tabla de especificaciones del hardware).
// CÓMO FUNCIONA: Recibe el resumen calculado por `computeDeviceTelemetry` y los
//           arreglos históricos; renderiza medidores lineales exactos (0-100%)
//           en lugar de polilíneas SVG estiradas que se deformaban.
// POR QUÉ: Eliminar las curvas grises deformadas del antiguo Sparkline SVG y
//           ofrecer una lectura técnica sobria, legible y profesional (< 200L).
// ============================================================================
'use client';

import React from 'react';
import { Cpu, Activity, Thermometer, Database, BarChart3, X } from 'lucide-react';
import type { DeviceInfo } from '../types';
import type { DeviceTelemetrySummary, TelemetryLevel } from './dashboard-helpers';

interface TelemetryModalProps {
  open: boolean;
  onClose: () => void;
  dark: boolean;
  device?: DeviceInfo | null;
  telemetry: DeviceTelemetrySummary;
  cpuHistory: number[];
  ramHistory: number[];
  tempHistory: number[];
  storHistory: number[];
}

/**
 * Tarjeta individual de métrica estilo monitor de sistema clásico:
 * Cabecera con valor en fuente monoespaciada + barra de progreso lineal exacta
 * + micro-histograma vertical de 14 muestras sin distorsión de aspecto.
 */
function MetricGaugeCard({
  dark, icon, label, value, percent, status, level, history,
}: {
  dark: boolean;
  icon: React.ReactNode;
  label: string;
  value: string;
  percent: number;
  status: string;
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
    <div className={`rounded-lg border p-3 flex flex-col justify-between gap-2.5 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-slate-50/80 border-slate-300 text-slate-900'}`}>
      {/* Fila 1: Icono + etiqueta y valor numérico monoespaciado */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 ${dark ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-white border-slate-300 text-slate-700'}`}>
            {icon}
          </div>
          <span className={`text-[11px] font-bold uppercase tracking-wider truncate ${dark ? 'text-zinc-300' : 'text-slate-700'}`}>{label}</span>
        </div>
        <span className="text-lg font-mono font-bold tracking-tight shrink-0">{value}</span>
      </div>

      {/* Fila 2: Barra de nivel lineal limpia (medidor técnico 0-100%) */}
      <div className={`w-full h-2 rounded-sm overflow-hidden border ${dark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-200 border-slate-300'}`}>
        <div className={`h-full transition-all duration-300 ${barFill}`} style={{ width: `${clamped}%` }} />
      </div>

      {/* Fila 3: Estado operativo + micro-histograma de barras verticales */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
          <span className={`text-[11px] font-semibold truncate ${statusTextCls}`}>{status}</span>
        </div>
        <div className="flex items-end gap-0.5 h-3.5 shrink-0" title="Histórico reciente">
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

/** Modal principal de Telemetría Completa del Sistema. */
export const TelemetryModal: React.FC<TelemetryModalProps> = ({
  open, onClose, dark, device, telemetry, cpuHistory, ramHistory, tempHistory, storHistory,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl rounded-lg border shadow-xl overflow-hidden ${dark ? 'bg-zinc-950 border-zinc-700 text-zinc-100' : 'bg-white border-slate-300 text-slate-900'}`}
      >
        {/* Barra de título estilo ventana de software técnico limpio */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100 border-slate-300'}`}>
          <div className="flex items-center gap-2.5">
            <BarChart3 size={15} className={dark ? 'text-zinc-300' : 'text-slate-700'} />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">Telemetría Completa del Sistema</h3>
              <p className={`text-[10px] ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Monitor de recursos en tiempo real y hardware de Android</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded border transition-colors ${dark ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-200'}`}
            title="Cerrar ventana"
          >
            <X size={14} />
          </button>
        </div>

        {/* Cuerpo: Cuadrícula 2x2 de medidores técnicos + resumen de hardware */}
        <div className="p-4 space-y-3 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricGaugeCard dark={dark} icon={<Cpu size={13} />} label="CPU" value={`${telemetry.cpuPercent}%`} percent={telemetry.cpuPercent} status={telemetry.cpuStatus} level={telemetry.cpuLevel} history={cpuHistory} />
            <MetricGaugeCard dark={dark} icon={<Activity size={13} />} label="Memoria RAM" value={`${telemetry.ramPercent}%`} percent={telemetry.ramPercent} status={telemetry.ramStatus} level={telemetry.ramLevel} history={ramHistory} />
            <MetricGaugeCard dark={dark} icon={<Thermometer size={13} />} label="Temperatura" value={`${telemetry.tempCelsius}°C`} percent={Math.min(100, Math.round((telemetry.tempNum / 60) * 100))} status={telemetry.tempStatus} level={telemetry.tempLevel} history={tempHistory} />
            <MetricGaugeCard dark={dark} icon={<Database size={13} />} label="Almacenamiento" value={`${telemetry.storagePercent}%`} percent={telemetry.storagePercent} status={telemetry.storStatus} level={telemetry.storLevel} history={storHistory} />
          </div>

          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded border text-[11px] font-mono ${dark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
            <div><span className="opacity-60 block text-[9px] uppercase">Modelo</span><strong className="truncate block">{device?.model || '--'}</strong></div>
            <div><span className="opacity-60 block text-[9px] uppercase">Serial</span><strong className="truncate block">{device?.serial || '--'}</strong></div>
            <div><span className="opacity-60 block text-[9px] uppercase">Android</span><strong className="truncate block">{device?.androidVersion || '--'}</strong></div>
            <div><span className="opacity-60 block text-[9px] uppercase">Batería</span><strong className="truncate block">{device?.battery !== undefined ? `${device.battery}%` : '--'}</strong></div>
          </div>
        </div>

        {/* Pie de ventana con botón de cierre sobrio */}
        <div className={`flex items-center justify-end px-4 py-2.5 border-t ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100 border-slate-300'}`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-1.5 rounded border text-xs font-bold transition-colors ${dark ? 'bg-zinc-100 text-zinc-950 border-zinc-200 hover:bg-white' : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'}`}
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};
