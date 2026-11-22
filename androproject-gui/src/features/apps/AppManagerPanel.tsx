// ============================================================================
// ARCHIVO: AppManagerPanel.tsx
// QUÉ HACE: Barra de búsqueda, filtros, ordenamiento, acciones por lote,
//           banner de respuesta ADB y renderizado progresivo de alta velocidad.
// CÓMO FUNCIONA: Monta inicialmente 60 tarjetas/filas y amplía automáticamente
//           en bloques de 80 al hacer scroll (`IntersectionObserver`) para que
//           la apertura de 400+ apps tome < 16ms (0 jank en el hilo principal).
// POR QUÉ: Lograr fluidez instantánea y mantener el archivo < 195 líneas (SRP).
// ============================================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone, Search, LayoutGrid, List, RefreshCw, Trash2,
  Loader2, CheckSquare, Square, EyeOff, Eye, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AppCard, AppRow } from './AppItemViews';
import type { AppInfo } from '../types';

export interface AppManagerPanelProps {
  dark: boolean;
  connected: boolean;
  serial?: string;
  totalCount: number;
  statusMessage?: { text: string; isError?: boolean } | null;
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
  handleBulkAction: (action: 'uninstall' | 'disable' | 'enable' | 'force_stop') => Promise<void>;
  appActionLoading: string | null;
  handleAppLaunch: (pkg: string) => Promise<void>;
  handleAppForceStop: (pkg: string) => Promise<void>;
  handleAppClearData: (pkg: string) => Promise<void>;
  handleAppExtractApk: (pkg: string) => Promise<void>;
  handleAppUninstall: (pkg: string) => Promise<void>;
  handleAppEnable: (pkg: string) => Promise<void>;
  handleAppDisable: (pkg: string) => Promise<void>;
}

const INITIAL_BATCH = 60;
const STEP_BATCH = 80;

export function AppManagerPanel(props: AppManagerPanelProps) {
  const {
    dark, connected, serial, totalCount, statusMessage,
    appsSearch, setAppsSearch, appsFilter, setAppsFilter,
    appsSort, setAppsSort, appsViewMode, setAppsViewMode,
    appsLoading, fetchApps, filteredApps,
    selectedPackages, togglePackageSelection, toggleSelectAllFiltered,
    handleBulkAction, appActionLoading,
    handleAppLaunch, handleAppForceStop, handleAppClearData, handleAppExtractApk,
    handleAppUninstall, handleAppEnable, handleAppDisable,
  } = props;

  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reinicia ventana progresiva al cambiar filtro, búsqueda u orden
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH);
  }, [appsSearch, appsFilter, appsSort, appsViewMode]);

  // Carga automática al acercarse al final de la lista visible
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= filteredApps.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(filteredApps.length, c + STEP_BATCH));
        }
      },
      { rootMargin: '320px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, filteredApps.length]);

  if (!connected && totalCount === 0) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-3xl mt-4">
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
  const allVisibleSelected = filteredApps.length > 0 && filteredApps.every((a) => selectedPackages.has(a.packageName));
  const visibleApps = filteredApps.slice(0, visibleCount);

  return (
    <div className="mx-auto w-full min-w-0 mt-4 space-y-3">
      <div className={`rounded-xl border p-3 ${dark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[190px]">
            <Input hideLabel label="Buscar aplicación" placeholder="Buscar por nombre o paquete..." value={appsSearch} onChange={(e) => setAppsSearch(e.target.value)} icon={<Search size={14} />} />
          </div>

          <select value={appsFilter} onChange={(e) => setAppsFilter(e.target.value)} className={selectCls}>
            <option value="all">Todas ({totalCount})</option>
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

          <Button variant="secondary" size="sm" icon={<CheckSquare size={13} />} onClick={() => toggleSelectAllFiltered(filteredApps)} disabled={filteredApps.length === 0}>
            {allVisibleSelected ? 'Deseleccionar' : `Seleccionar (${filteredApps.length})`}
          </Button>

          <div className={`flex items-center gap-1 p-1 rounded-lg border ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100 border-slate-200'}`}>
            <Button variant="ghost" size="sm" aria-label="Vista cuadrícula" onClick={() => setAppsViewMode('grid')} className={`p-1.5 h-auto ${appsViewMode === 'grid' ? (dark ? 'bg-zinc-800 text-zinc-100' : 'bg-white text-slate-900') : ''}`}><LayoutGrid size={14} /></Button>
            <Button variant="ghost" size="sm" aria-label="Vista lista" onClick={() => setAppsViewMode('list')} className={`p-1.5 h-auto ${appsViewMode === 'list' ? (dark ? 'bg-zinc-800 text-zinc-100' : 'bg-white text-slate-900') : ''}`}><List size={14} /></Button>
          </div>

          <Button variant="secondary" size="sm" aria-label="Actualizar catálogo" onClick={fetchApps} disabled={appsLoading} className="px-2.5">
            <RefreshCw size={14} className={appsLoading ? 'animate-spin' : ''} />
          </Button>
        </div>

        {selectedPackages.size > 0 && (
          <div className={`flex flex-wrap items-center gap-2 mt-2.5 pt-2.5 border-t ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${dark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-slate-100 border-slate-300 text-slate-900'}`}>{selectedPackages.size} seleccionadas</span>
            <Button variant="secondary" size="sm" icon={<Square size={11} />} onClick={() => handleBulkAction('force_stop')}>Detener lote</Button>
            <Button variant="secondary" size="sm" icon={<EyeOff size={11} />} onClick={() => handleBulkAction('disable')}>Deshabilitar lote</Button>
            <Button variant="secondary" size="sm" icon={<Eye size={11} />} onClick={() => handleBulkAction('enable')}>Habilitar lote</Button>
            <Button variant="danger" size="sm" icon={<Trash2 size={11} />} onClick={() => handleBulkAction('uninstall')}>Desinstalar lote</Button>
          </div>
        )}
      </div>

      {statusMessage && (
        <div className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-center gap-2 ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'} ${statusMessage.isError ? 'text-red-400' : 'text-emerald-400'}`}>
          {statusMessage.isError ? <AlertCircle size={14} className="shrink-0" /> : <CheckCircle2 size={14} className="shrink-0" />}
          <span className="font-mono break-all">{statusMessage.text}</span>
        </div>
      )}

      {appsLoading && totalCount === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className={`animate-spin ${dark ? 'text-zinc-300' : 'text-slate-700'}`} />
          <span className={`ml-2.5 text-sm ${dark ? 'text-zinc-300' : 'text-slate-700'}`}>Cargando paquetes reales del dispositivo...</span>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className={`rounded-xl border p-10 text-center ${dark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'}`}>
          <Search size={28} className={`mx-auto mb-2 ${dark ? 'text-zinc-500' : 'text-slate-400'}`} />
          <p className={`font-semibold text-sm ${dark ? 'text-zinc-300' : 'text-slate-700'}`}>No se encontraron aplicaciones</p>
        </div>
      ) : (
        <>
          <div className={appsViewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5' : 'space-y-1.5'}>
            {visibleApps.map((app, idx) => {
              const ViewComp = appsViewMode === 'grid' ? AppCard : AppRow;
              return (
                <ViewComp
                  key={app.packageName ? `${app.packageName}-${idx}` : `app-${idx}`}
                  app={app} dark={dark} serial={serial}
                  selected={selectedPackages.has(app.packageName)}
                  actionLoading={appActionLoading === app.packageName}
                  onToggleSelect={() => togglePackageSelection(app.packageName)}
                  onLaunch={() => handleAppLaunch(app.packageName)}
                  onForceStop={() => handleAppForceStop(app.packageName)}
                  onClearData={() => handleAppClearData(app.packageName)}
                  onExtractApk={() => handleAppExtractApk(app.packageName)}
                  onUninstall={() => handleAppUninstall(app.packageName)}
                  onDisable={() => handleAppDisable(app.packageName)}
                  onEnable={() => handleAppEnable(app.packageName)}
                />
              );
            })}
          </div>
          {visibleCount < filteredApps.length && (
            <div ref={sentinelRef} className="flex items-center justify-center py-4">
              <Button variant="secondary" size="sm" onClick={() => setVisibleCount(filteredApps.length)}>
                Mostrando {visibleCount} de {filteredApps.length} · Ver todas
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
