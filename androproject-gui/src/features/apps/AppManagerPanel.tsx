// ============================================================================
// ARCHIVO: AppManagerPanel.tsx
// QUÉ HACE: Barra de búsqueda, filtros, ordenamiento, selección por lote y
//           renderizado en cuadrícula o lista de las apps instaladas.
// CÓMO FUNCIONA: Recibe el catálogo filtrado y delega cada ítem a `AppCard` o
//           `AppRow`, con soporte completo para modo claro y oscuro.
// POR QUÉ: Mantener la vista de administración limpia, modular y < 200 líneas.
// ============================================================================

'use client';

import React from 'react';
import { Smartphone, Search, LayoutGrid, List, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AppCard, AppRow } from './AppItemViews';
import type { AppInfo } from '../types';

export interface AppManagerPanelProps {
  dark: boolean;
  connected: boolean;
  serial?: string;
  appsSearch: string;
  setAppsSearch: (v: string) => void;
  appsFilter: string;
  setAppsFilter: (v: string) => void;
  appsSort: string;
  setAppsSort: (v: string) => void;
  appsViewMode: string;
  setAppsViewMode: (v: string) => void;
  appsLoading: boolean;
  fetchApps: () => Promise<void>;
  filteredApps: AppInfo[];
  selectedPackages: Set<string>;
  togglePackageSelection: (pkg: string) => void;
  toggleSelectAllFiltered: (list: AppInfo[]) => void;
  handleBulkUninstall: () => Promise<void>;
  appActionLoading: string | null;
  handleAppUninstall: (pkg: string) => Promise<void>;
  handleAppEnable: (pkg: string) => Promise<void>;
  handleAppDisable: (pkg: string) => Promise<void>;
}

export function AppManagerPanel(props: AppManagerPanelProps) {
  const {
    dark, connected, serial,
    appsSearch, setAppsSearch, appsFilter, setAppsFilter,
    appsSort, setAppsSort, appsViewMode, setAppsViewMode,
    appsLoading, fetchApps, filteredApps,
    selectedPackages, togglePackageSelection, toggleSelectAllFiltered,
    handleBulkUninstall, appActionLoading,
    handleAppUninstall, handleAppEnable, handleAppDisable,
  } = props;

  if (!connected) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-3xl mt-5">
        <div className={`rounded-xl border p-10 text-center ${dark ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'}`}>
          <Smartphone size={32} className={`mx-auto mb-3 ${dark ? 'text-zinc-500' : 'text-slate-400'}`} />
          <p className="font-semibold text-sm mb-1">Conecta un dispositivo para gestionar aplicaciones</p>
          <p className={`text-xs ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
            La lectura real de paquetes y APKs requiere un teléfono Android vía ADB.
          </p>
        </div>
      </div>
    );
  }

  const selectCls = `px-3 py-2 text-xs rounded-lg border outline-none font-medium ${
    dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-300 text-slate-800'
  }`;

  return (
    <div className="mx-auto w-full min-w-0 mt-5 space-y-4">
      {/* Barra de controles */}
      <div className={`rounded-xl border p-3 ${dark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex-1 min-w-[200px]">
            <Input
              hideLabel
              label="Buscar aplicación"
              placeholder="Buscar por nombre o paquete..."
              value={appsSearch}
              onChange={(e) => setAppsSearch(e.target.value)}
              icon={<Search size={14} />}
            />
          </div>

          <select value={appsFilter} onChange={(e) => setAppsFilter(e.target.value)} className={selectCls}>
            <option value="all">Todas ({filteredApps.length})</option>
            <option value="user">Usuario</option>
            <option value="system">Sistema</option>
            <option value="safe">Seguras para quitar</option>
            <option value="bloatware">Bloatware</option>
            <option value="google">Google</option>
            <option value="disabled">Deshabilitadas</option>
            <option value="hidden">Ocultas</option>
            <option value="adware">Con overlay</option>
            <option value="malware">Amenazas</option>
            <option value="critical">Críticas</option>
          </select>

          <select value={appsSort} onChange={(e) => setAppsSort(e.target.value)} className={selectCls}>
            <option value="name_asc">Nombre A-Z</option>
            <option value="name_desc">Nombre Z-A</option>
            <option value="date_desc">Más recientes</option>
            <option value="date_asc">Más antiguas</option>
            <option value="size_desc">Más pesadas</option>
            <option value="size_asc">Más ligeras</option>
          </select>

          <div className={`flex items-center gap-1 p-1 rounded-lg border ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100 border-slate-200'}`}>
            <Button variant="ghost" size="sm" aria-label="Vista cuadrícula" onClick={() => setAppsViewMode('grid')} className={`p-1.5 h-auto ${appsViewMode === 'grid' ? (dark ? 'bg-zinc-800 text-zinc-100' : 'bg-white text-slate-900') : ''}`}>
              <LayoutGrid size={14} />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Vista lista" onClick={() => setAppsViewMode('list')} className={`p-1.5 h-auto ${appsViewMode === 'list' ? (dark ? 'bg-zinc-800 text-zinc-100' : 'bg-white text-slate-900') : ''}`}>
              <List size={14} />
            </Button>
          </div>

          <Button variant="secondary" size="sm" aria-label="Actualizar" onClick={fetchApps} disabled={appsLoading} className="px-2.5">
            <RefreshCw size={14} className={appsLoading ? 'animate-spin' : ''} />
          </Button>
        </div>

        {selectedPackages.size > 0 && (
          <div className={`flex flex-wrap items-center gap-2.5 mt-2.5 pt-2.5 border-t ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${dark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-slate-100 border-slate-300 text-slate-900'}`}>
              {selectedPackages.size} seleccionadas
            </span>
            <Button variant="secondary" size="sm" onClick={() => toggleSelectAllFiltered(filteredApps)}>
              {filteredApps.every((a) => selectedPackages.has(a.packageName)) ? 'Deseleccionar todas' : 'Seleccionar todas'}
            </Button>
            <Button variant="danger" size="sm" icon={<Trash2 size={11} />} onClick={handleBulkUninstall}>
              Desinstalar seleccionadas
            </Button>
          </div>
        )}
      </div>

      {/* Contenido */}
      {appsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className={`animate-spin ${dark ? 'text-zinc-300' : 'text-slate-700'}`} />
          <span className={`ml-2.5 text-sm ${dark ? 'text-zinc-300' : 'text-slate-700'}`}>Cargando paquetes reales del dispositivo...</span>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className={`rounded-xl border p-10 text-center ${dark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'}`}>
          <Search size={28} className={`mx-auto mb-2 ${dark ? 'text-zinc-500' : 'text-slate-400'}`} />
          <p className={`font-semibold text-sm ${dark ? 'text-zinc-300' : 'text-slate-700'}`}>No se encontraron aplicaciones</p>
        </div>
      ) : appsViewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
          {filteredApps.map((app, idx) => (
            <AppCard
              key={app.packageName ? `${app.packageName}-${idx}` : `app-${idx}`}
              app={app} dark={dark} serial={serial}
              selected={selectedPackages.has(app.packageName)}
              actionLoading={appActionLoading === app.packageName}
              onToggleSelect={() => togglePackageSelection(app.packageName)}
              onUninstall={() => handleAppUninstall(app.packageName)}
              onDisable={() => handleAppDisable(app.packageName)}
              onEnable={() => handleAppEnable(app.packageName)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredApps.map((app, idx) => (
            <AppRow
              key={app.packageName ? `${app.packageName}-${idx}` : `app-${idx}`}
              app={app} dark={dark} serial={serial}
              selected={selectedPackages.has(app.packageName)}
              actionLoading={appActionLoading === app.packageName}
              onToggleSelect={() => togglePackageSelection(app.packageName)}
              onUninstall={() => handleAppUninstall(app.packageName)}
              onDisable={() => handleAppDisable(app.packageName)}
              onEnable={() => handleAppEnable(app.packageName)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
