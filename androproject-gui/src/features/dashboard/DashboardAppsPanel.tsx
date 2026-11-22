// ============================================================================
// ARCHIVO: DashboardAppsPanel.tsx
// QUÉ HACE: Renderiza la cuadrícula de dos columnas del panel principal:
//           1) Acciones rápidas del sistema (con ejecución real, spinner y
//              feedback inline) y 2) Mini-gestor de aplicaciones instaladas.
// CÓMO FUNCIONA: Ejecuta navegación, apertura segura de `/camera` y `/ios-mirror`
//           (compatible con Tauri Desktop y navegador), reinicio ADB con estado
//           en vivo, apertura de ficha técnica y acciones reales sobre apps.
// POR QUÉ: Evitar acciones silenciosas o rutas erróneas en Acciones Rápidas,
//          manteniendo el archivo bajo 200 líneas (SOLID).
// ============================================================================
'use client';

import React, { useState } from 'react';
import {
  MonitorPlay, Wrench, RefreshCw, Info, Camera, Airplay,
  Search, Trash2, Play, ChevronRight, Loader2,
} from 'lucide-react';
import { RealAppIcon } from '@/components/ui/RealAppIcon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getAppColor, type AppsFilterDash } from './dashboard-helpers';
import type { AppInfo, NavSection } from '../types';

interface DashboardAppsPanelProps {
  dark: boolean; serial?: string; appsList: AppInfo[]; filteredApps: AppInfo[];
  appsLoading: boolean; appActionLoading: string | null; searchQuery: string;
  onSearchChange: (q: string) => void; activeFilter: AppsFilterDash; onFilterChange: (f: AppsFilterDash) => void;
  onUninstall: (pkg: string) => void; onNavigate: (section: NavSection) => void; onOpenDeviceInfo: () => void;
  onRunAction: (action: string, label: string) => Promise<{ success?: boolean; message?: string; error?: string }>;
}

/** Fila de acción rápida con icono, título, subtítulo y estado de carga. */
function ActionRow({ icon, title, sub, busy, onClick }: {
  icon: React.ReactNode; title: string; sub: string; busy?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button" disabled={busy} aria-busy={busy} onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-overlay disabled:opacity-65"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-base text-text-secondary">{busy ? <Loader2 size={16} className="animate-spin" /> : icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="text-xs text-text-secondary">{sub}</p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-text-tertiary" />
    </button>
  );
}

/** Panel combinado de Acciones Rápidas + Mini-Gestor de Aplicaciones. */
export const DashboardAppsPanel: React.FC<DashboardAppsPanelProps> = ({
  dark, serial, appsList, filteredApps, appsLoading, appActionLoading,
  searchQuery, onSearchChange, activeFilter, onFilterChange,
  onUninstall, onNavigate, onOpenDeviceInfo, onRunAction,
}) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [quickStatus, setQuickStatus] = useState<string | null>(null);

  const cardCls = 'min-w-0 rounded-lg border border-border bg-surface-card p-4 shadow-sm';
  const safeCount = appsList.filter((a) => a.safeToRemove).length;

  const chips: { key: AppsFilterDash; label: string; count: number }[] = [
    { key: 'all', label: 'Todas', count: appsList.length },
    { key: 'user', label: 'Usuario', count: appsList.filter((a) => !a.isSystem).length },
    { key: 'system', label: 'Sistema', count: appsList.filter((a) => a.isSystem).length },
    { key: 'safe', label: 'Seguro quitar', count: safeCount },
  ];

  const handleRestartAdb = async () => {
    setBusyKey('restart_adb');
    setQuickStatus('Reiniciando servidor ADB...');
    try {
      const res = await onRunAction('restart_adb', 'Reiniciando servidor ADB');
      setQuickStatus(res?.success ? (res.message || 'Servidor ADB reiniciado correctamente.') : (res?.error || 'No se pudo reiniciar ADB.'));
    } finally { setBusyKey(null); }
  };

  const handleLiveProjection = async () => {
    if (serial && !serial.startsWith('airplay-') && !serial.startsWith('apple-')) {
      setBusyKey('projection');
      setQuickStatus('Iniciando proyección en vivo...');
      try { await onRunAction('open_screen', 'Iniciando proyección en vivo'); }
      finally { setBusyKey(null); }
    }
    onNavigate('projection');
  };

  const handleLaunchApp = async (pkg: string) => {
    setQuickStatus(`Abriendo ${pkg}...`);
    try {
      const r = await fetch('/api/apps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'launch', packageName: pkg, serial }),
      });
      const d = await r.json();
      setQuickStatus(d.success ? `Aplicación iniciada: ${pkg}` : (d.error || `No se pudo abrir ${pkg}`));
    } catch { setQuickStatus(`Error de red al abrir ${pkg}`); }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Columna 1: Acciones rápidas del sistema */}
      <div className={cardCls}>
        <div>
          <h2 className="mb-3 text-base font-bold text-text-primary">Acciones rápidas</h2>
          <div className="divide-y divide-border-subtle">
            <ActionRow icon={<MonitorPlay size={17} />} title="Proyección en vivo" sub="Ver pantalla del dispositivo a 60 FPS" busy={busyKey === 'projection'} onClick={handleLiveProjection} />
            <ActionRow icon={<Camera size={17} />} title="Cámara WebRTC 4K" sub="Transmitir y grabar con la cámara trasera" onClick={() => window.location.assign('/camera')} />
            <ActionRow icon={<Airplay size={17} />} title="Espejo Apple AirPlay 2" sub="Abrir el visor de iPhone" onClick={() => window.location.assign('/ios-mirror')} />
            <ActionRow icon={<Wrench size={17} />} title="Herramientas del sistema" sub="Modo desarrollador, reinicios y diagnósticos" onClick={() => onNavigate('tools')} />
            <ActionRow icon={<RefreshCw size={17} />} title="Reiniciar ADB" sub="Restablecer el servidor de conexión" busy={busyKey === 'restart_adb'} onClick={handleRestartAdb} />
            <ActionRow icon={<Info size={17} />} title="Información del dispositivo" sub="Ver telemetría y detalles técnicos" onClick={onOpenDeviceInfo} />
          </div>
        </div>
        {quickStatus && (
          <div role="status" className="mt-3 break-words rounded-md border border-border bg-surface-base px-3 py-2 text-xs text-text-secondary">
            {quickStatus}
          </div>
        )}
      </div>

      {/* Columna 2: Mini-gestor de aplicaciones instaladas */}
      <div className={cardCls}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-text-primary">Aplicaciones {appsList.length > 0 && `(${appsList.length})`}</h2>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('apps')}>Ver todas</Button>
        </div>

        <div className="mb-3">
          <Input hideLabel label="Buscar aplicaciones o paquetes" placeholder="Buscar por nombre o paquete" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} icon={<Search size={16} />} />
        </div>

        <div className="flex gap-1 mb-2 flex-wrap">
          {chips.map((chip) => (
            <button
              key={chip.key} type="button" aria-pressed={activeFilter === chip.key} onClick={() => onFilterChange(chip.key)}
              className={`min-h-8 rounded-md border px-2.5 text-xs font-semibold transition-colors hover:bg-surface-overlay ${
                activeFilter === chip.key ? 'border-border-selected bg-surface-selected text-text-selected'
                                          : 'border-border-control bg-surface-card text-text-secondary'
              }`}
            >
              {chip.label} {chip.count > 0 && <span className="opacity-80">({chip.count})</span>}
            </button>
          ))}
        </div>

        <div className="space-y-0.5 max-h-[260px] overflow-y-auto custom-scrollbar">
          {appsLoading ? (
            <div className={`text-xs text-center py-4 ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Cargando aplicaciones...</div>
          ) : filteredApps.length > 0 ? (
            filteredApps.map((app, idx) => (
              <div key={app.packageName ? `${app.packageName}-${idx}` : `app-${idx}`} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group ${dark ? 'hover:bg-zinc-900' : 'hover:bg-slate-100'}`}>
                <RealAppIcon packageName={app.packageName} appName={app.name} serial={serial} fallbackColor={getAppColor(app.packageName)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-semibold truncate ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>{app.name}</p>
                    {app.safeToRemove && <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${dark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-slate-100 border-slate-300 text-slate-800'}`}>SEGURO</span>}
                    {app.isSystem && !app.safeToRemove && <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${dark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-200 text-slate-800'}`}>SYS</span>}
                  </div>
                  <p className={`text-[11px] font-mono truncate ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>{app.packageName}</p>
                </div>
                <button type="button" onClick={() => handleLaunchApp(app.packageName)} className="grid size-8 shrink-0 place-items-center rounded-md text-text-secondary hover:bg-surface-overlay" aria-label={`Abrir ${app.name}`} title="Abrir aplicación en el teléfono"><Play size={15} /></button>
                <button type="button" onClick={() => onUninstall(app.packageName)} disabled={appActionLoading === app.packageName || app.criticalSystem} className="grid size-8 shrink-0 place-items-center rounded-md text-semantic-danger hover:bg-surface-overlay disabled:opacity-45" aria-label={`Desinstalar ${app.name}`} title="Desinstalar paquete"><Trash2 size={15} /></button>
              </div>
            ))
          ) : (
            <div className={`text-xs text-center py-4 ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>{searchQuery ? 'Sin resultados para la búsqueda' : 'Sin aplicaciones listadas'}</div>
          )}
        </div>

        <p className={`text-[11px] mt-2 pt-2 border-t ${dark ? 'text-zinc-400 border-zinc-800' : 'text-slate-600 border-slate-200'}`}>
          Mostrando {filteredApps.length} de {appsList.length} aplicaciones{safeCount > 0 && <span className="ml-1 font-semibold">· {safeCount} seguras para quitar</span>}
        </p>
      </div>
    </div>
  );
};
