// ============================================================================
// ARCHIVO: DashboardView.tsx
// QUÉ HACE: Vista principal del estudio (Dashboard) que integra la barra
//           compacta de telemetría en vivo, la ventana modal de medidores
//           técnicos y el panel dual de acciones rápidas y aplicaciones.
// CÓMO FUNCIONA: Mantiene un buffer circular de 20 muestras de CPU, RAM,
//           Temperatura y Disco a partir del dispositivo activo, delegando
//           el renderizado a subcomponentes especializados (< 200 líneas).
// POR QUÉ: Reemplazar el antiguo archivo monolítico de 627 líneas aplicando
//           Clean Architecture y Single Responsibility Principle (SOLID).
// ============================================================================
'use client';

import React, { useState, useEffect, useMemo } from 'react';
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

export function DashboardView({ device: propDevice, onNavigate }: DashboardViewProps = {}) {
  const { dark } = useTheme();
  const storeDevice = useAppStore((s) => s.device);
  const device = propDevice || storeDevice;
  const storeSetActiveNav = useAppStore((s) => s.setActiveNav);
  const nav = (section: NavSection) => (onNavigate || storeSetActiveNav)(section);
  const { run, fetchApps } = useActions();

  // Cálculo puro y determinista de métricas operativas
  const telemetry = useMemo(() => computeDeviceTelemetry(device), [device]);

  // Buffers circulares de 20 muestras para los micro-histogramas de telemetría
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);
  const [tempHistory, setTempHistory] = useState<number[]>([]);
  const [storHistory, setStorHistory] = useState<number[]>([]);

  useEffect(() => {
    if (!device) return;
    setCpuHistory((prev) => [...prev.slice(-19), telemetry.cpuPercent]);
    setRamHistory((prev) => [...prev.slice(-19), telemetry.ramPercent]);
    setTempHistory((prev) => [...prev.slice(-19), telemetry.tempNum]);
    setStorHistory((prev) => [...prev.slice(-19), telemetry.storagePercent]);
  }, [device, telemetry.cpuPercent, telemetry.ramPercent, telemetry.tempNum, telemetry.storagePercent]);

  // Estado global de aplicaciones instaladas
  const appsList = useAppStore((s) => s.appsList);
  const appsLoading = useAppStore((s) => s.appsLoading);
  const appActionLoading = useAppStore((s) => s.appActionLoading);
  const setAppActionLoading = useAppStore((s) => s.setAppActionLoading);

  const [appsSearchDash, setAppsSearchDash] = useState('');
  const [appsFilterDash, setAppsFilterDash] = useState<AppsFilterDash>('all');
  const [showMetricsSheet, setShowMetricsSheet] = useState(false);

  // Carga inicial de paquetes al detectar cambio de serial del dispositivo
  useEffect(() => {
    if (device?.serial) fetchApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.serial]);

  // Filtrado en memoria por búsqueda y categoría
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

  // Desinstalación segura de paquete vía API
  const handleDashUninstall = async (pkg: string) => {
    if (!confirm(`¿Desinstalar ${pkg}?`)) return;
    setAppActionLoading(pkg);
    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uninstall', packageName: pkg, serial: device?.serial }),
      });
      const d = await res.json();
      if (d.success) fetchApps();
      else alert(`Error: ${d.error}`);
    } catch {
      alert('Error de red al desinstalar');
    } finally {
      setAppActionLoading(null);
    }
  };

  const pillCls = `flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono font-medium transition-colors shrink-0 ${
    dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
  }`;

  return (
    <ViewShell navId="dashboard">
      <div className="space-y-3">
        {/* Cabecera del Panel Principal */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className={`text-base font-bold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>Panel principal</h1>
            <p className={`text-xs ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Información general del dispositivo y estado del sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => nav('projection')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors ${
                dark ? 'bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border-zinc-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-300'
              }`}
            >
              <MonitorPlay size={13} /> Ver pantalla
            </button>
            <button
              type="button"
              onClick={() => run('radar', 'Actualizando...')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors ${
                dark ? 'bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border-zinc-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-300'
              }`}
            >
              <RefreshCw size={13} /> Actualizar
            </button>
          </div>
        </div>

        {/* Barra compacta de telemetría (abre ficha técnica limpia al pulsar) */}
        {device && (
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
            <button type="button" onClick={() => setShowMetricsSheet(true)} className={pillCls} title="Ver telemetría de CPU">
              <Cpu size={12} /> <span>CPU {telemetry.cpuPercent}%</span>
            </button>
            <button type="button" onClick={() => setShowMetricsSheet(true)} className={pillCls} title="Ver telemetría de RAM">
              <Activity size={12} /> <span>RAM {telemetry.ramPercent}%</span>
            </button>
            <button type="button" onClick={() => setShowMetricsSheet(true)} className={pillCls} title="Ver temperatura térmica">
              <Thermometer size={12} /> <span>TEMP {telemetry.tempCelsius}°C</span>
            </button>
            <button type="button" onClick={() => setShowMetricsSheet(true)} className={pillCls} title="Ver almacenamiento interno">
              <Database size={12} /> <span>DISCO {telemetry.storagePercent}%</span>
            </button>
            <button type="button" onClick={() => setShowMetricsSheet(true)} className={pillCls} title="Abrir monitor completo">
              <BarChart3 size={12} /> <span>Detalles</span>
            </button>
          </div>
        )}

        {/* Ventana Modal de Telemetría Limpia (sin curvas SVG deformadas) */}
        <TelemetryModal
          open={showMetricsSheet}
          onClose={() => setShowMetricsSheet(false)}
          dark={dark}
          device={device}
          telemetry={telemetry}
          cpuHistory={cpuHistory}
          ramHistory={ramHistory}
          tempHistory={tempHistory}
          storHistory={storHistory}
        />

        {/* Paneles de Acciones Rápidas y Aplicaciones Instaladas */}
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
          onRunAction={run}
        />
      </div>
    </ViewShell>
  );
}
