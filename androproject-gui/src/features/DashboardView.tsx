'use client';

import React, { useState, useEffect, useMemo, useId } from 'react';
import {
  Thermometer, Cpu, Activity, Database,
  RefreshCw, ChevronRight, Terminal, Info, MonitorPlay,
  Search, Trash2,
} from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { useActions } from '@/hooks/useActions';
import { ViewShell } from '@/components/ViewShell';
import type { DeviceInfo, NavSection, AppInfo } from './types';

interface DashboardViewProps {
  device?: DeviceInfo | null;
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onNavigate?: (section: NavSection) => void;
}

/* ── Sparkline SVG ──────────────────────────────────────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const gradId = useId();
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 120;
  const h = 26;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible w-full">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradId})`} points={areaPoints} />
      <polyline fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

/* ── Apps filter type ── */
type AppsFilterDash = 'all' | 'user' | 'system' | 'safe' | 'bloatware';

/* ── App colors by package prefix ── */
const APP_COLORS: Record<string, string> = {
  'com.android.chrome': '#4285F4',
  'com.google.android': '#3DDC84',
  'com.spotify': '#1DB954',
  'com.whatsapp': '#25D366',
  'com.instagram': '#E4405F',
  'com.facebook': '#1877F2',
  'com.twitter': '#1DA1F2',
  'com.youtube': '#FF0000',
  'com.netflix': '#E50914',
  'com.telegram': '#0088CC',
  'com.oplus': '#1BAE6E',
  'com.coloros': '#1BAE6E',
};

function getAppColor(pkg: string): string {
  for (const [prefix, color] of Object.entries(APP_COLORS)) {
    if (pkg.startsWith(prefix)) return color;
  }
  // Generate color from package name hash
  let hash = 0;
  for (let i = 0; i < pkg.length; i++) {
    hash = pkg.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 50%)`;
}

export function DashboardView({ device: propDevice, onNavigate }: DashboardViewProps = {}) {
  const { dark } = useTheme();
  const storeDevice = useAppStore((s) => s.device);
  const device = propDevice || storeDevice;
  const storeSetActiveNav = useAppStore((s) => s.setActiveNav);
  const nav = (section: NavSection) => (onNavigate || storeSetActiveNav)(section);
  const { run, fetchApps } = useActions();

  // Real device metrics
  const cpuPercent = device?.cpuUsagePercent ?? 0;
  const ramPercent = device?.ramUsagePercent ?? 0;
  const storagePercent = device?.storageUsagePercent ?? 0;
  const storageFreeGB = device?.storageFreeGB ?? 0;
  const rawTemp = device?.temperature ?? '--';

  // Parse temperature (handles both "34.0" °C and raw "340" tenths of °C)
  const parseTempNum = (t: string) => {
    if (!t || t === '--') return null;
    let v = parseFloat(t);
    if (isNaN(v)) return null;
    if (v > 100) v = v / 10;
    return v;
  };
  const tempParsed = parseTempNum(rawTemp);
  const tempCelsius = tempParsed !== null ? tempParsed.toFixed(0) : '--';

  // Status helpers
  const cpuStatus = cpuPercent < 50 ? 'Normal' : cpuPercent < 80 ? 'Uso alto' : 'Crítico';
  const cpuStatusColor: 'green' | 'blue' | 'orange' = cpuPercent < 50 ? 'green' : cpuPercent < 80 ? 'blue' : 'orange';
  const ramStatus = ramPercent < 60 ? 'Uso normal' : ramPercent < 85 ? 'Uso alto' : 'Crítico';
  const ramStatusColor: 'green' | 'blue' | 'orange' = ramPercent < 60 ? 'blue' : ramPercent < 85 ? 'orange' : 'orange';
  const tempNum = tempParsed !== null ? Math.round(tempParsed) : 0;
  const tempStatus = tempParsed === null ? 'Desconocido' : tempNum < 42 ? 'Normal' : tempNum < 48 ? 'Temperatura alta' : 'Sobrecalentamiento';
  const tempStatusColor: 'green' | 'blue' | 'orange' = tempNum < 42 ? 'green' : tempNum < 48 ? 'orange' : 'orange';
  const storStatus = storageFreeGB > 0 ? `${storageFreeGB} GB libres` : '--';

  // Historical sparkline data (tracked over time)
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);
  const [tempHistory, setTempHistory] = useState<number[]>([]);
  const [storHistory, setStorHistory] = useState<number[]>([]);

  // Track metrics history
  useEffect(() => {
    if (!device) return;
    setCpuHistory(prev => [...prev.slice(-19), cpuPercent]);
    setRamHistory(prev => [...prev.slice(-19), ramPercent]);
    setTempHistory(prev => [...prev.slice(-19), tempNum]);
    setStorHistory(prev => [...prev.slice(-19), storagePercent]);
  }, [cpuPercent, ramPercent, tempNum, storagePercent]);

  // Apps from global store (fetched by useActions.fetchApps)
  const appsList = useAppStore((s) => s.appsList);
  const appsLoading = useAppStore((s) => s.appsLoading);
  const appActionLoading = useAppStore((s) => s.appActionLoading);
  const setAppActionLoading = useAppStore((s) => s.setAppActionLoading);

  const [appsSearchDash, setAppsSearchDash] = useState('');
  const [appsFilterDash, setAppsFilterDash] = useState<AppsFilterDash>('all');

  // Fetch apps on mount and every 30s
  useEffect(() => {
    fetchApps();
    const interval = setInterval(fetchApps, 30000);
    return () => clearInterval(interval);
  }, [fetchApps]);

  // Filtered + searched apps for dashboard
  const filteredDashApps = useMemo(() => {
    let filtered = appsList;
    // Search filter
    if (appsSearchDash) {
      const q = appsSearchDash.toLowerCase();
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q)
      );
    }
    // Category filter
    if (appsFilterDash === 'user') filtered = filtered.filter(a => !a.isSystem);
    if (appsFilterDash === 'system') filtered = filtered.filter(a => a.isSystem);
    if (appsFilterDash === 'safe') filtered = filtered.filter(a => a.safeToRemove);
    if (appsFilterDash === 'bloatware') filtered = filtered.filter(a => a.isBloatware);
    return filtered;
  }, [appsList, appsSearchDash, appsFilterDash]);

  // Uninstall handler
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
      if (d.success) {
        // Refresh apps list
        fetchApps();
      } else {
        alert(`Error: ${d.error}`);
      }
    } catch {
      alert('Error de red al desinstalar');
    } finally {
      setAppActionLoading(null);
    }
  };

  return (
    <ViewShell navId="dashboard">
      <div className="space-y-3">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>Panel principal</h1>
            <p className={`text-[10px] ${dark ? 'text-white/40' : 'text-slate-400'}`}>
              Información general del dispositivo y estado del sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => nav('projection')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                dark
                  ? 'bg-[#22c97d]/10 text-[#22c97d] hover:bg-[#22c97d]/20 border border-[#22c97d]/20'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <MonitorPlay size={12} /> Ver pantalla
            </button>
            <button
              onClick={() => run('radar', 'Actualizando...')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                dark
                  ? 'bg-[#1bae6e]/10 text-[#22c97d] hover:bg-[#1bae6e]/20 border border-[#1bae6e]/20'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <RefreshCw size={12} /> Actualizar
            </button>
          </div>
        </div>

        {/* System metrics — 4 compact cards */}
        {device && (
          <div>
            <h2 className={`text-xs font-bold mb-2 ${dark ? 'text-white/60' : 'text-slate-600'}`}>Estado del sistema</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MetricCard
                dark={dark}
                icon={<Cpu size={14} className="text-emerald-500" />}
                label="CPU"
                value={`${cpuPercent}%`}
                status={cpuStatus}
                statusColor={cpuStatusColor}
                data={cpuHistory}
                sparkColor="#10b981"
              />
              <MetricCard
                dark={dark}
                icon={<Activity size={14} className="text-blue-500" />}
                label="RAM"
                value={`${ramPercent}%`}
                status={ramStatus}
                statusColor={ramStatusColor}
                data={ramHistory}
                sparkColor="#3b82f6"
              />
              <MetricCard
                dark={dark}
                icon={<Thermometer size={14} className="text-orange-500" />}
                label="Temperatura"
                value={`${tempCelsius}°C`}
                status={tempStatus}
                statusColor={tempStatusColor}
                data={tempHistory}
                sparkColor="#f97316"
              />
              <MetricCard
                dark={dark}
                icon={<Database size={14} className="text-purple-500" />}
                label="Almacenamiento"
                value={`${storagePercent}%`}
                status={storStatus}
                statusColor="purple"
                data={storHistory}
                sparkColor="#a855f7"
              />
            </div>
          </div>
        )}

        {/* Two columns: Quick Actions + Running Apps */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* Quick actions */}
          <div className={`cosmic-card cosmic-rim rounded-xl border p-3 ${dark ? 'bg-white/[0.025] border-white/[0.07]' : 'bg-white border-slate-200 shadow-sm'}`}>
            <h3 className={`text-xs font-bold mb-2 ${dark ? 'text-white/70' : 'text-slate-700'}`}>Acciones rápidas</h3>
            <div className="space-y-0.5">
              <ActionRow
                dark={dark}
                icon={<MonitorPlay size={14} />}
                title="Proyección en vivo"
                sub="Ver pantalla del dispositivo"
                onClick={() => nav('projection')}
              />
              <ActionRow
                dark={dark}
                icon={<Terminal size={14} />}
                title="Abrir Shell ADB"
                sub="Acceso directo interactivo"
                onClick={() => nav('tools')}
              />
              <ActionRow
                dark={dark}
                icon={<RefreshCw size={14} />}
                title="Reiniciar ADB"
                sub="Restablecer la conexión"
                onClick={() => run('restart_adb', 'Reiniciando ADB')}
              />
              <ActionRow
                dark={dark}
                icon={<Info size={14} />}
                title="Información del dispositivo"
                sub="Ver detalles completos"
                onClick={() => nav('config')}
              />
            </div>
          </div>

          {/* Real running apps — mini manager */}
          <div className={`cosmic-card cosmic-rim rounded-xl border p-3 ${dark ? 'bg-white/[0.025] border-white/[0.07]' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-xs font-bold ${dark ? 'text-white/70' : 'text-slate-700'}`}>
                Aplicaciones {appsList.length > 0 && `(${appsList.length})`}
              </h3>
              <button
                onClick={() => nav('apps')}
                className={`text-[10px] font-semibold ${dark ? 'text-[#22c97d] hover:text-[#2edc8a]' : 'text-emerald-600 hover:text-emerald-700'}`}
              >
                Ver todas
              </button>
            </div>

            {/* Search bar */}
            <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-2 ${dark ? 'bg-white/[0.03] border border-white/5' : 'bg-slate-50 border border-slate-200'}`}>
              <Search size={12} className={`${dark ? 'text-white/30' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Buscar apps..."
                value={appsSearchDash}
                onChange={(e) => setAppsSearchDash(e.target.value)}
                className={`flex-1 bg-transparent text-[11px] outline-none ${dark ? 'text-white/80 placeholder:text-white/20' : 'text-slate-700 placeholder:text-slate-400'}`}
              />
            </div>

            {/* Filter chips */}
            <div className="flex gap-1 mb-2 flex-wrap">
              {([
                { key: 'all' as const, label: 'Todas', count: appsList.length },
                { key: 'user' as const, label: 'Usuario', count: appsList.filter(a => !a.isSystem).length },
                { key: 'system' as const, label: 'Sistema', count: appsList.filter(a => a.isSystem).length },
                { key: 'safe' as const, label: 'Seguro quitar', count: appsList.filter(a => a.safeToRemove).length },
              ]).map(chip => (
                <button
                  key={chip.key}
                  onClick={() => setAppsFilterDash(chip.key)}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${
                    appsFilterDash === chip.key
                      ? (dark ? 'bg-[#22c97d]/20 text-[#22c97d] border border-[#22c97d]/30' : 'bg-emerald-100 text-emerald-700 border border-emerald-300')
                      : (dark ? 'bg-white/[0.03] text-white/30 border border-white/5 hover:bg-white/[0.06]' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200')
                  }`}
                >
                  {chip.label} {chip.count > 0 && <span className="opacity-60">({chip.count})</span>}
                </button>
              ))}
            </div>

            {/* App list */}
            <div className="space-y-0.5 max-h-[260px] overflow-y-auto custom-scrollbar">
              {appsLoading ? (
                <div className={`text-[10px] text-center py-4 ${dark ? 'text-white/20' : 'text-slate-400'}`}>
                  Cargando aplicaciones...
                </div>
              ) : filteredDashApps.length > 0 ? (
                filteredDashApps.map((app) => (
                  <div
                    key={app.packageName}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group ${dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: getAppColor(app.packageName) }}
                    >
                      {app.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-[11px] font-semibold truncate ${dark ? 'text-white/80' : 'text-slate-700'}`}>
                          {app.name}
                        </p>
                        {app.safeToRemove && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold shrink-0">
                            SEGURO
                          </span>
                        )}
                        {app.isSystem && !app.safeToRemove && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold shrink-0">
                            SYS
                          </span>
                        )}
                        {app.isBloatware && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-orange-500/10 text-orange-400 font-bold shrink-0">
                            BLOAT
                          </span>
                        )}
                      </div>
                      <p className={`text-[9px] font-mono truncate ${dark ? 'text-white/25' : 'text-slate-400'}`}>
                        {app.packageName}
                      </p>
                    </div>
                    {/* Uninstall button — visible on hover */}
                    <button
                      onClick={() => handleDashUninstall(app.packageName)}
                      disabled={appActionLoading === app.packageName}
                      className={`shrink-0 p-1 rounded-md transition-all opacity-0 group-hover:opacity-100 ${
                        appActionLoading === app.packageName
                          ? 'animate-spin text-white/20'
                          : 'text-red-400/60 hover:text-red-400 hover:bg-red-500/10'
                      }`}
                      title={app.safeToRemove ? 'Desinstalar de forma segura' : 'Desinstalar (puede afectar el sistema)'}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              ) : (
                <div className={`text-[10px] text-center py-4 ${dark ? 'text-white/20' : 'text-slate-400'}`}>
                  {appsSearchDash ? 'Sin resultados' : 'Sin aplicaciones'}
                </div>
              )}
            </div>

            <p className={`text-[9px] mt-2 pt-2 border-t ${dark ? 'text-white/25 border-white/5' : 'text-slate-400 border-slate-100'}`}>
              {filteredDashApps.length} de {appsList.length} apps
              {appsList.filter(a => a.safeToRemove).length > 0 && (
                <span className="text-emerald-500 ml-1">
                  · {appsList.filter(a => a.safeToRemove).length} seguras para quitar
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </ViewShell>
  );
}

/* ── MetricCard — miniatura compacta ──────────────────────────── */
function MetricCard({ dark, icon, label, value, status, statusColor, data, sparkColor }: {
  dark: boolean;
  icon: React.ReactNode;
  label: string;
  value: string;
  status: string;
  statusColor: 'green' | 'blue' | 'orange' | 'purple';
  data: number[];
  sparkColor: string;
}) {
  const dotColor = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
  }[statusColor];
  const textColor = {
    green: dark ? 'text-green-400' : 'text-green-600',
    blue: dark ? 'text-blue-400' : 'text-blue-600',
    orange: dark ? 'text-orange-400' : 'text-orange-600',
    purple: dark ? 'text-purple-400' : 'text-purple-600',
  }[statusColor];
  const iconBg = {
    green: 'bg-emerald-500/15 text-emerald-500',
    blue: 'bg-blue-500/15 text-blue-500',
    orange: 'bg-orange-500/15 text-orange-500',
    purple: 'bg-purple-500/15 text-purple-500',
  }[statusColor];

  return (
    <div className={`cosmic-card cosmic-rim relative rounded-xl border p-2.5 h-[76px] overflow-hidden ${dark ? 'bg-white/[0.025] border-white/[0.07]' : 'bg-white border-slate-200 shadow-sm'}`}>
      {/* Sparkline de fondo */}
      <div className="absolute inset-x-0 bottom-0 h-6 opacity-50 pointer-events-none">
        <Sparkline data={data} color={sparkColor} />
      </div>

      <div className="relative flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className={`text-[8px] uppercase tracking-widest font-bold ${dark ? 'text-white/40' : 'text-slate-400'}`}>
            {label}
          </p>
          <p className={`text-lg font-bold leading-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
            {value}
          </p>
        </div>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>

      <div className="relative flex items-center gap-1 mt-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
        <span className={`text-[8px] font-semibold truncate ${textColor}`}>{status}</span>
      </div>
    </div>
  );
}

/* ── ActionRow ────────────────────────────────────────────────── */
function ActionRow({ dark, icon, title, sub, onClick }: {
  dark: boolean;
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
        dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
      }`}
    >
      <span className={`shrink-0 ${dark ? 'text-white/30' : 'text-slate-400'}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-semibold ${dark ? 'text-white/80' : 'text-slate-700'}`}>{title}</p>
        <p className={`text-[9px] ${dark ? 'text-white/30' : 'text-slate-400'}`}>{sub}</p>
      </div>
      <ChevronRight size={12} className={`shrink-0 ${dark ? 'text-white/15' : 'text-slate-300'}`} />
    </button>
  );
}
