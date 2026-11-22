// ============================================================================
// ARCHIVO: DashboardView.tsx
// QUÉ HACE: Vista principal del estudio (Dashboard) que integra la barra
//           compacta de telemetría en vivo, la ventana modal de medidores
//           técnicos reales y el panel dual de acciones rápidas y aplicaciones.
// CÓMO FUNCIONA: Consulta `/api/device` en tiempo real para actualizar un
//           buffer circular de 20 muestras de CPU (delta /proc/stat), RAM
//           (/proc/meminfo), Temperatura (dumpsys battery) y Disco (df -k).
// POR QUÉ: Garantizar telemetría 100% real sin valores estáticos ni simulados,
//           con componentes pequeños y limpios (< 200 líneas, SOLID).
// ============================================================================
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Thermometer, Cpu, Activity, Database,
  RefreshCw, MonitorPlay, BarChart3,
} from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { useActions } from '@/hooks/useActions';
import { ViewShell } from '@/components/ViewShell';
import { computeDeviceTelemetry, type AppsFilterDash } from './dashboard/dashboard-helpers';
import { TelemetryModal } from './dashboard/TelemetryModal';
import { DashboardAppsPanel } from './dashboard/DashboardAppsPanel';
import type { DeviceInfo, NavSection } from './types';

interface DashboardViewProps {
  device?: DeviceInfo | null;
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onNavigate?: (section: NavSection) => void;
}

export function DashboardView({ device: propDevice, addLog: propAddLog, onNavigate }: DashboardViewProps = {}) {
  const { dark } = useTheme();
  const storeDevice = useAppStore((s) => s.device);
  const setStoreDevice = useAppStore((s) => s.setDevice);
  const storeAddLog = useAppStore((s) => s.addLog);
  const device = propDevice || storeDevice;
  const storeSetActiveNav = useAppStore((s) => s.setActiveNav);
  const nav = (section: NavSection) => (onNavigate || storeSetActiveNav)(section);
  const { run, fetchApps } = useActions();
  const [dashMsg, setDashMsg] = useState<string | null>(null);

  // Cálculo puro y determinista de métricas operativas reales del kernel
  const telemetry = useMemo(() => computeDeviceTelemetry(device), [device]);

  // Buffers circulares de 20 muestras reales para los micro-histogramas
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);
  const [tempHistory, setTempHistory] = useState<number[]>([]);
  const [storHistory, setStorHistory] = useState<number[]>([]);
  const [showMetricsSheet, setShowMetricsSheet] = useState(false);

  // Consulta directa a `/api/device` para refrescar sensores del kernel Android
  const refreshLiveTelemetry = useCallback(async () => {
    if (!device?.serial) return;
    try {
      const res = await fetch(`/api/device?serial=${encodeURIComponent(device.serial)}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.activeDevice) setStoreDevice(data.activeDevice);
    } catch { /* Silencioso ante desconexión momentánea */ }
  }, [device?.serial, setStoreDevice]);

  useEffect(() => {
    if (!device) return;
    setCpuHistory((prev) => [...prev.slice(-19), telemetry.cpuPercent]);
    setRamHistory((prev) => [...prev.slice(-19), telemetry.ramPercent]);
    setTempHistory((prev) => [...prev.slice(-19), telemetry.tempNum]);
    setStorHistory((prev) => [...prev.slice(-19), telemetry.storagePercent]);
  }, [device, telemetry.cpuPercent, telemetry.ramPercent, telemetry.tempNum, telemetry.storagePercent]);

  // Polling activo cada 2.5s mientras la ficha de telemetría está abierta
  useEffect(() => {
    if (!showMetricsSheet || !device?.serial) return;
    refreshLiveTelemetry();
    const timer = setInterval(refreshLiveTelemetry, 2500);
    return () => clearInterval(timer);
  }, [showMetricsSheet, device?.serial, refreshLiveTelemetry]);

  const appsList = useAppStore((s) => s.appsList);
  const appsLoading = useAppStore((s) => s.appsLoading);
  const appActionLoading = useAppStore((s) => s.appActionLoading);
  const setAppActionLoading = useAppStore((s) => s.setAppActionLoading);
  const [appsSearchDash, setAppsSearchDash] = useState('');
  const [appsFilterDash, setAppsFilterDash] = useState<AppsFilterDash>('all');

  useEffect(() => {
    if (device?.serial) fetchApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.serial]);

  const filteredDashApps = useMemo(() => {
    let list = appsList;
    if (appsSearchDash) {
      const q = appsSearchDash.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q));
    }
    if (appsFilterDash === 'user') list = list.filter((a) => !a.isSystem);
    if (appsFilterDash === 'system') list = list.filter((a) => a.isSystem);
    if (appsFilterDash === 'safe') list = list.filter((a) => a.safeToRemove);
    if (appsFilterDash === 'bloatware') list = list.filter((a) => a.isBloatware);
    return list;
  }, [appsList, appsSearchDash, appsFilterDash]);

  const handleDashUninstall = async (pkg: string) => {
    if (!confirm(`¿Desinstalar ${pkg}?`)) return;
    setAppActionLoading(pkg);
    const logFn = (msg: string, t: 'info' | 'success' | 'error') => (propAddLog ? propAddLog(msg, t) : storeAddLog(msg));
    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uninstall', packageName: pkg, serial: device?.serial }),
      });
      const d = await res.json();
      if (d.success) { setDashMsg(`Desinstalada: ${pkg}`); logFn(`Desinstalada: ${pkg}`, 'success'); fetchApps(); }
      else { setDashMsg(`Error al desinstalar ${pkg}: ${d.error}`); logFn(`Error: ${d.error}`, 'error'); }
    } catch { setDashMsg(`Error de red al desinstalar ${pkg}`); logFn(`Error de red al desinstalar ${pkg}`, 'error'); }
    finally { setAppActionLoading(null); }
  };

  const btnCls = `flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${
    dark ? 'bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border-zinc-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-300'
  }`;
  const pillCls = `flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-mono font-medium transition-colors shrink-0 ${
    dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
  }`;

  return (
    <ViewShell navId="dashboard">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className={`text-base font-bold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>Panel principal</h1>
            <p className={`text-xs ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Telemetría real del kernel Android y gestión rápida del sistema</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => nav('projection')} className={btnCls}><MonitorPlay size={13} /> Ver pantalla</button>
            <button type="button" onClick={refreshLiveTelemetry} className={btnCls}><RefreshCw size={13} /> Actualizar</button>
          </div>
        </div>

        {device && (
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
            <button type="button" onClick={() => setShowMetricsSheet(true)} className={pillCls} title={telemetry.cpuSubDetail}><Cpu size={12} /> <span>CPU {telemetry.cpuPercent}%</span></button>
            <button type="button" onClick={() => setShowMetricsSheet(true)} className={pillCls} title={telemetry.ramSubDetail}><Activity size={12} /> <span>RAM {telemetry.ramPercent}% ({device.ramUsed || '--'})</span></button>
            <button type="button" onClick={() => setShowMetricsSheet(true)} className={pillCls} title={telemetry.tempSubDetail}><Thermometer size={12} /> <span>TEMP {telemetry.tempCelsius}°C</span></button>
            <button type="button" onClick={() => setShowMetricsSheet(true)} className={pillCls} title={telemetry.storSubDetail}><Database size={12} /> <span>DISCO {telemetry.storagePercent}% ({telemetry.storageFreeGB}G libre)</span></button>
            <button type="button" onClick={() => setShowMetricsSheet(true)} className={pillCls} title="Abrir monitor completo"><BarChart3 size={12} /> <span>Monitor</span></button>
          </div>
        )}

        {dashMsg && (
          <div className={`rounded-lg border px-3 py-1.5 text-xs font-mono ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
            {dashMsg}
          </div>
        )}

        <TelemetryModal open={showMetricsSheet} onClose={() => setShowMetricsSheet(false)} onRefresh={refreshLiveTelemetry} dark={dark} device={device} telemetry={telemetry} cpuHistory={cpuHistory} ramHistory={ramHistory} tempHistory={tempHistory} storHistory={storHistory} />
        <DashboardAppsPanel
          dark={dark}
          serial={device?.serial}
          appsList={appsList}
          filteredApps={filteredDashApps}
          appsLoading={appsLoading}
          appActionLoading={appActionLoading}
          searchQuery={appsSearchDash}
          onSearchChange={setAppsSearchDash}
          activeFilter={appsFilterDash}
          onFilterChange={setAppsFilterDash}
          onUninstall={handleDashUninstall}
          onNavigate={nav}
          onOpenDeviceInfo={() => { setShowMetricsSheet(true); refreshLiveTelemetry(); }}
          onRunAction={run}
        />
      </div>
    </ViewShell>
  );
}
