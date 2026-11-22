// ============================================================================
// ARCHIVO: DashboardAppsPanel.tsx
// QUÉ HACE: Renderiza la cuadrícula de dos columnas del panel principal:
//           1) Acciones rápidas del sistema y 2) Mini-gestor de aplicaciones
//           instaladas con iconos reales extraídos por ADB.
// CÓMO FUNCIONA: Filtra en memoria las aplicaciones del store global según
//           búsqueda y categoría (Todas, Usuario, Sistema, Seguro quitar) y
//           ejecuta desinstalaciones vía POST `/api/apps`.
// POR QUÉ: Separar la gestión de apps y accesos rápidos del contenedor de
//           telemetría para mantener cada archivo bajo 200 líneas (SOLID).
// ============================================================================
'use client';

import React from 'react';
import {
  MonitorPlay, Wrench, RefreshCw, Info, Camera, Airplay,
  Search, Trash2, Play, ChevronRight,
} from 'lucide-react';
import { RealAppIcon } from '@/components/ui/RealAppIcon';
import { getAppColor, type AppsFilterDash } from './dashboard-helpers';
import type { AppInfo, NavSection } from '../types';

interface DashboardAppsPanelProps {
  dark: boolean;
  serial?: string;
  appsList: AppInfo[];
  filteredApps: AppInfo[];
  appsLoading: boolean;
  appActionLoading: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: AppsFilterDash;
  onFilterChange: (f: AppsFilterDash) => void;
  onUninstall: (pkg: string) => void;
  onNavigate: (section: NavSection) => void;
  onRunAction: (action: string, label: string) => void;
}

/** Fila de acción rápida con icono, título, subtítulo y flecha lateral. */
function ActionRow({
  dark, icon, title, sub, onClick,
}: {
  dark: boolean;
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
        dark ? 'hover:bg-zinc-900' : 'hover:bg-slate-100'
      }`}
    >
      <span className={`shrink-0 ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-semibold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>{title}</p>
        <p className={`text-[10px] ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>{sub}</p>
      </div>
      <ChevronRight size={13} className={`shrink-0 ${dark ? 'text-zinc-500' : 'text-slate-500'}`} />
    </button>
  );
}

/** Panel combinado de Acciones Rápidas + Mini-Gestor de Aplicaciones. */
export const DashboardAppsPanel: React.FC<DashboardAppsPanelProps> = ({
  dark, serial, appsList, filteredApps, appsLoading, appActionLoading,
  searchQuery, onSearchChange, activeFilter, onFilterChange,
  onUninstall, onNavigate, onRunAction,
}) => {
  const cardCls = dark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200 shadow-sm';
  const safeCount = appsList.filter((a) => a.safeToRemove).length;

  const chips: { key: AppsFilterDash; label: string; count: number }[] = [
    { key: 'all', label: 'Todas', count: appsList.length },
    { key: 'user', label: 'Usuario', count: appsList.filter((a) => !a.isSystem).length },
    { key: 'system', label: 'Sistema', count: appsList.filter((a) => a.isSystem).length },
    { key: 'safe', label: 'Seguro quitar', count: safeCount },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Columna 1: Acciones rápidas del sistema */}
      <div className={`rounded-xl border p-3.5 ${cardCls}`}>
        <h3 className={`text-xs font-bold mb-2 ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>Acciones rápidas</h3>
        <div className="space-y-0.5">
          <ActionRow dark={dark} icon={<MonitorPlay size={14} />} title="Proyección en vivo" sub="Ver pantalla del dispositivo a 60 FPS" onClick={() => onNavigate('projection')} />
          <ActionRow dark={dark} icon={<Camera size={14} />} title="Cámara WebRTC 4K" sub="Transmitir y grabar cámara trasera (/camera)" onClick={() => window.open('/camera', '_blank', 'noopener,noreferrer')} />
          <ActionRow dark={dark} icon={<Airplay size={14} />} title="Espejo Apple AirPlay 2" sub="Visor dedicado iPhone 60 FPS (/ios-mirror)" onClick={() => window.open('/ios-mirror', '_blank', 'noopener,noreferrer')} />
          <ActionRow dark={dark} icon={<Wrench size={14} />} title="Herramientas del sistema" sub="Reinicios y diagnósticos" onClick={() => onNavigate('tools')} />
          <ActionRow dark={dark} icon={<RefreshCw size={14} />} title="Reiniciar ADB" sub="Restablecer el servidor de conexión" onClick={() => onRunAction('restart_adb', 'Reiniciando ADB')} />
          <ActionRow dark={dark} icon={<Info size={14} />} title="Información del dispositivo" sub="Ver detalles técnicos completos" onClick={() => onNavigate('config')} />
        </div>
      </div>

      {/* Columna 2: Mini-gestor de aplicaciones instaladas */}
      <div className={`rounded-xl border p-3.5 ${cardCls}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className={`text-xs font-bold ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>
            Aplicaciones {appsList.length > 0 && `(${appsList.length})`}
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('apps')}
            className={`text-[11px] font-semibold hover:underline ${dark ? 'text-zinc-300' : 'text-slate-700'}`}
          >
            Ver todas
          </button>
        </div>

        {/* Buscador de paquetes */}
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-2 border ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-300'}`}>
          <Search size={12} className={dark ? 'text-zinc-400' : 'text-slate-600'} />
          <input
            type="text"
            placeholder="Buscar aplicaciones o paquetes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`flex-1 bg-transparent text-xs outline-none ${dark ? 'text-zinc-100 placeholder:text-zinc-500' : 'text-slate-900 placeholder:text-slate-500'}`}
          />
        </div>

        {/* Chips de filtrado */}
        <div className="flex gap-1 mb-2 flex-wrap">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onFilterChange(chip.key)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors ${
                activeFilter === chip.key
                  ? dark ? 'bg-zinc-100 text-zinc-950 border-zinc-100' : 'bg-slate-900 text-white border-slate-900'
                  : dark ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              {chip.label} {chip.count > 0 && <span className="opacity-80">({chip.count})</span>}
            </button>
          ))}
        </div>

        {/* Lista desplazable de aplicaciones con icono real APK */}
        <div className="space-y-0.5 max-h-[260px] overflow-y-auto custom-scrollbar">
          {appsLoading ? (
            <div className={`text-xs text-center py-4 ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Cargando aplicaciones...</div>
          ) : filteredApps.length > 0 ? (
            filteredApps.map((app, idx) => (
              <div
                key={app.packageName ? `${app.packageName}-${idx}` : `app-${idx}`}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group ${dark ? 'hover:bg-zinc-900' : 'hover:bg-slate-100'}`}
              >
                <RealAppIcon packageName={app.packageName} appName={app.name} serial={serial} fallbackColor={getAppColor(app.packageName)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-semibold truncate ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>{app.name}</p>
                    {app.safeToRemove && <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${dark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-slate-100 border-slate-300 text-slate-800'}`}>SEGURO</span>}
                    {app.isSystem && !app.safeToRemove && <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${dark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-200 text-slate-800'}`}>SYS</span>}
                  </div>
                  <p className={`text-[11px] font-mono truncate ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>{app.packageName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => fetch('/api/apps', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'launch', packageName: app.packageName, serial }),
                  })}
                  className={`shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer ${dark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-slate-700 hover:bg-slate-200'}`}
                  title="Abrir aplicación en el teléfono"
                >
                  <Play size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onUninstall(app.packageName)}
                  disabled={appActionLoading === app.packageName || app.criticalSystem}
                  className={`shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer disabled:opacity-30 ${dark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-slate-700 hover:bg-slate-200'}`}
                  title="Desinstalar paquete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          ) : (
            <div className={`text-xs text-center py-4 ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>
              {searchQuery ? 'Sin resultados para la búsqueda' : 'Sin aplicaciones listadas'}
            </div>
          )}
        </div>

        <p className={`text-[11px] mt-2 pt-2 border-t ${dark ? 'text-zinc-400 border-zinc-800' : 'text-slate-600 border-slate-200'}`}>
          Mostrando {filteredApps.length} de {appsList.length} aplicaciones
          {safeCount > 0 && <span className="ml-1 font-semibold">· {safeCount} seguras para quitar</span>}
        </p>
      </div>
    </div>
  );
};
