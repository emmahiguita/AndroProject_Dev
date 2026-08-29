'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Image from 'next/image';
import {
  Smartphone, RefreshCw, LayoutGrid, List,
  Search, Sparkles, Trash2, Eye, EyeOff,
  Settings, Download,
} from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AppInfo, DeviceInfo } from './types';

// ── Shared helpers ─────────────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(timestamp: number): string {
  if (!timestamp || timestamp === 0) return '--';
  return new Date(timestamp).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

// ── AppIcon ────────────────────────────────────────────────────────
function AppIcon({ app, dark }: { app: AppInfo; dark: boolean }) {
  const [imgError, setImgError] = useState(false);
  const iconUrl = `/api/apps/icon?package=${app.packageName}`;

  if (imgError) {
    const IconComponent = app.isSystem ? Settings : LayoutGrid;
    return (
      <div className={`w-10 h-10 rounded-xl ${dark ? 'bg-white/[0.05] text-white/40' : 'bg-slate-100 text-slate-400'} flex items-center justify-center shrink-0`}>
        <IconComponent size={20} />
      </div>
    );
  }

  return (
    <Image
      src={iconUrl}
      alt={app.name}
      width={40}
      height={40}
      unoptimized
      onError={() => setImgError(true)}
      loading="lazy"
      className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/5 shadow-inner"
    />
  );
}

// ── Main View ──────────────────────────────────────────────────────

interface AppsViewProps {
  device?: DeviceInfo | null;
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function AppsView({ device: propDevice, addLog: propAddLog }: AppsViewProps = {}) {
  const { t, dark } = useTheme();
  const appsSubTab = useAppStore((s) => s.appsSubTab);
  const setAppsSubTab = useAppStore((s) => s.setAppsSubTab);
  const storeAddLog = useAppStore((s) => s.addLog);
  const addLog = propAddLog || storeAddLog;
  const activeSerial = useAppStore((s) => s.activeSerial);
  const storeDevice = useAppStore((s) => s.device);
  const device = propDevice || storeDevice;
  const appsSearch = useAppStore((s) => s.appsSearch);
  const setAppsSearch = useAppStore((s) => s.setAppsSearch);
  const appsFilter = useAppStore((s) => s.appsFilter);
  const setAppsFilter = useAppStore((s) => s.setAppsFilter);
  const appsSort = useAppStore((s) => s.appsSort);
  const setAppsSort = useAppStore((s) => s.setAppsSort);
  const appsViewMode = useAppStore((s) => s.appsViewMode);
  const setAppsViewMode = useAppStore((s) => s.setAppsViewMode);
  const appsList = useAppStore((s) => s.appsList);
  const appsLoading = useAppStore((s) => s.appsLoading);
  const setAppsLoading = useAppStore((s) => s.setAppsLoading);
  const setAppsList = useAppStore((s) => s.setAppsList);
  const selectedPackages = useAppStore((s) => s.selectedPackages);
  const setSelectedPackages = useAppStore((s) => s.setSelectedPackages);
  const togglePackageSelection = useAppStore((s) => s.togglePackageSelection);
  const appActionLoading = useAppStore((s) => s.appActionLoading);
  const setAppActionLoading = useAppStore((s) => s.setAppActionLoading);

  // ── fetchApps (local — calls /api/apps, not /api/actions) ───────
  const fetchApps = useCallback(async () => {
    if (!activeSerial || activeSerial === 'Hardware Level') return;
    setAppsLoading(true);
    setSelectedPackages(new Set());
    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', serial: activeSerial })
      });
      const data = await res.json();
      if (data.success && data.apps) {
        setAppsList(data.apps);
      } else {
        addLog(`✗ Error cargando apps: ${data.error}`);
      }
    } catch (err: unknown) {
      addLog(`✗ Error de red cargando apps: ${getErrorMessage(err)}`);
    } finally {
      setAppsLoading(false);
    }
  }, [activeSerial, addLog, setAppsLoading, setSelectedPackages, setAppsList]);

  useEffect(() => {
    if (appsSubTab === 'manager' && activeSerial && activeSerial !== 'Hardware Level') {
      fetchApps();
    }
  }, [appsSubTab, activeSerial, fetchApps]);

  // ── filteredApps (computed) ─────────────────────────────────────
  const filteredApps = useMemo(() => {
    const filtered = appsList.filter(app => {
      const matchesSearch = app.name.toLowerCase().includes(appsSearch.toLowerCase()) ||
                            app.packageName.toLowerCase().includes(appsSearch.toLowerCase());
      if (!matchesSearch) return false;
      if (appsFilter === 'system') return app.isSystem || app.isBloatware;
      if (appsFilter === 'user') return !app.isSystem;
      if (appsFilter === 'hidden') return app.isHidden;
      if (appsFilter === 'adware') return app.hasOverlay;
      if (appsFilter === 'disabled') return app.isDisabled;
      if (appsFilter === 'google') return app.isGoogle;
      if (appsFilter === 'malware') return app.isMalware;
      if (appsFilter === 'bloatware') return app.isBloatware;
      if (appsFilter === 'safe') return app.safeToRemove;
      if (appsFilter === 'critical') return app.criticalSystem;
      return true;
    });
    return filtered.sort((a, b) => {
      if (appsSort === 'name_asc') return a.name.localeCompare(b.name);
      if (appsSort === 'name_desc') return b.name.localeCompare(a.name);
      if (appsSort === 'date_desc') return (b.date || 0) - (a.date || 0);
      if (appsSort === 'date_asc') return (a.date || 0) - (b.date || 0);
      if (appsSort === 'size_desc') return (b.size || 0) - (a.size || 0);
      if (appsSort === 'size_asc') return (a.size || 0) - (b.size || 0);
      return 0;
    });
  }, [appsList, appsSearch, appsFilter, appsSort]);

  // ── App action handlers ─────────────────────────────────────────
  const toggleSelectAllFiltered = (list: AppInfo[]) => {
    const names = list.map(a => a.packageName);
    const allSel = names.every(n => selectedPackages.has(n));
    const next = new Set(selectedPackages);
    if (allSel) names.forEach(n => next.delete(n));
    else names.forEach(n => next.add(n));
    setSelectedPackages(next);
  };

  const handleBulkUninstall = async () => {
    const count = selectedPackages.size;
    if (count === 0) return;
    
    // Check for critical system apps in selection
    const criticalPkgs = Array.from(selectedPackages).filter(pkg => {
      const app = appsList.find(a => a.packageName === pkg);
      return app?.criticalSystem;
    });
    
    const safePkgs = Array.from(selectedPackages).filter(pkg => {
      const app = appsList.find(a => a.packageName === pkg);
      return app?.safeToRemove;
    });
    
    let warningMsg = `¿Desinstalar ${count} aplicaciones seleccionadas?`;
    if (criticalPkgs.length > 0) {
      warningMsg += `\n\n⚠️ PELIGRO: ${criticalPkgs.length} son apps CRÍTICAS del sistema:`;
      warningMsg += `\n${criticalPkgs.slice(0, 5).join('\n')}`;
      if (criticalPkgs.length > 5) warningMsg += `\n... y ${criticalPkgs.length - 5} más`;
      warningMsg += `\n\nEsto puede causar inestabilidad del dispositivo.`;
    }
    if (safePkgs.length > 0) {
      warningMsg += `\n\n✅ ${safePkgs.length} son seguras para quitar.`;
    }
    
    if (!confirm(warningMsg)) return;
    setAppsLoading(true);
    let sc = 0, fc = 0;
    for (const pkgName of Array.from(selectedPackages)) {
      addLog(`Desinstalando lote: ${pkgName}...`);
      try {
        const res = await fetch('/api/apps', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'uninstall', packageName: pkgName, serial: activeSerial })
        });
        const d = await res.json();
        d.success ? sc++ : (fc++, addLog(`✗ Error en ${pkgName}: ${d.error}`));
      } catch (err: unknown) {
        fc++; addLog(`✗ Error de red en ${pkgName}: ${getErrorMessage(err)}`);
      }
    }
    addLog(`✓ Desinstalación múltiple completada: ${sc} éxitos, ${fc} fallos.`);
    alert(`Desinstalación en lote completada:\n\nÉxitos: ${sc}\nFallos: ${fc}`);
    setSelectedPackages(new Set());
    fetchApps();
  };

  const handleAppUninstall = async (pkgName: string) => {
    // Find the app to check safety classification
    const app = appsList.find(a => a.packageName === pkgName);
    
    if (app?.criticalSystem) {
      if (!confirm(`⚠️ PELIGRO: "${pkgName}" es una app CRÍTICA del sistema.\n\nDesinstalarla puede causar inestabilidad, bloqueos o pérdida de funcionalidad esencial.\n\n¿Continuar de todas formas?`)) return;
    } else if (app?.safeToRemove) {
      if (!confirm(`✅ "${pkgName}" es segura para desinstalar.\n\nNo afectará la funcionalidad del dispositivo.\n\n¿Desinstalar?`)) return;
    } else if (app?.isSystem) {
      if (!confirm(`⚠️ "${pkgName}" es una app del sistema.\n\nSe desinstalará solo para tu usuario (se puede restaurar).\n\n¿Continuar?`)) return;
    } else {
      if (!confirm(`¿Desinstalar ${pkgName}?`)) return;
    }
    setAppActionLoading(pkgName);
    try {
      const res = await fetch('/api/apps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uninstall', packageName: pkgName, serial: activeSerial })
      });
      const d = await res.json();
      if (d.success) { addLog(`✓ ${d.message}`); fetchApps(); }
      else { addLog(`✗ Error al desinstalar: ${d.error}`); alert(`Error: ${d.error}`); }
    } catch (err: unknown) {
      addLog(`✗ Error de red: ${getErrorMessage(err)}`);
    } finally {
      setAppActionLoading(null);
    }
  };

  const handleAppDisable = async (pkgName: string) => {
    setAppActionLoading(pkgName);
    try {
      const res = await fetch('/api/apps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable', packageName: pkgName, serial: activeSerial })
      });
      const d = await res.json();
      if (d.success) { addLog(`✓ ${d.message}`); fetchApps(); }
      else { addLog(`✗ Error al deshabilitar: ${d.error}`); alert(`Error: ${d.error}`); }
    } catch (err: unknown) {
      addLog(`✗ Error de red: ${getErrorMessage(err)}`);
    } finally {
      setAppActionLoading(null);
    }
  };

  const handleAppEnable = async (pkgName: string) => {
    setAppActionLoading(pkgName);
    try {
      const res = await fetch('/api/apps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable', packageName: pkgName, serial: activeSerial })
      });
      const d = await res.json();
      if (d.success) { addLog(`✓ ${d.message}`); fetchApps(); }
      else { addLog(`✗ Error al habilitar: ${d.error}`); alert(`Error: ${d.error}`); }
    } catch (err: unknown) {
      addLog(`✗ Error de red: ${getErrorMessage(err)}`);
    } finally {
      setAppActionLoading(null);
    }
  };

  // ── Type adapters for ManagerPanel (store setters are narrower) ─
  const setAppsFilterStr = (v: string) => (setAppsFilter as (v: unknown) => void)(v);
  const setAppsViewModeStr = (v: string) => (setAppsViewMode as (v: unknown) => void)(v);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <ViewShell navId="apps">

      {/* Navigation Sub-Tabs */}
      <div className={`custom-scrollbar flex gap-6 overflow-x-auto border-b pb-3 ${dark ? 'border-white/5' : 'border-slate-200'}`}>
        <button
          onClick={() => setAppsSubTab('installer')}
          className={`pb-2 text-sm font-bold transition-all relative ${
            appsSubTab === 'installer' ? 'text-[#22c97d] border-b-2 border-[#1bae6e]' : `${t.textMuted} ${dark ? 'hover:text-white' : 'hover:text-slate-700'}`
          }`}
        >
          Instalar APK
        </button>
        <button
          onClick={() => setAppsSubTab('manager')}
          className={`pb-2 text-sm font-bold transition-all relative ${
            appsSubTab === 'manager' ? 'text-[#22c97d] border-b-2 border-[#1bae6e]' : `${t.textMuted} ${dark ? 'hover:text-white' : 'hover:text-slate-700'}`
          }`}
        >
          Administrar Aplicaciones
        </button>
      </div>

      {appsSubTab === 'installer' ? (
        <InstallerPanel dark={dark} t={t} addLog={addLog} activeSerial={activeSerial} device={device} />
      ) : (
        <ManagerPanel
          dark={dark} t={t}
          device={device}
          appsSearch={appsSearch} setAppsSearch={setAppsSearch}
          appsFilter={appsFilter} setAppsFilter={setAppsFilterStr}
          appsSort={appsSort} setAppsSort={setAppsSort}
          appsViewMode={appsViewMode} setAppsViewMode={setAppsViewModeStr}
          appsLoading={appsLoading} fetchApps={fetchApps}
          filteredApps={filteredApps}
          selectedPackages={selectedPackages} togglePackageSelection={togglePackageSelection}
          toggleSelectAllFiltered={toggleSelectAllFiltered}
          handleBulkUninstall={handleBulkUninstall}
          appActionLoading={appActionLoading}
          handleAppUninstall={handleAppUninstall}
          handleAppEnable={handleAppEnable}
          handleAppDisable={handleAppDisable}
        />
      )}
    </ViewShell>
  );
}

// ── Installer Sub-panel ────────────────────────────────────────────

function InstallerPanel({
  dark, t, addLog, activeSerial, device,
}: {
  dark: boolean;
  t: Record<string, string>;
  addLog: (msg: string) => void;
  activeSerial: string | null;
  device: { connected: boolean } | null;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl mt-5">
      <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner">
            <Smartphone size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold">Instalar APK en el dispositivo</h2>
            <p className={`text-xs ${t.textMuted} mt-0.5`}>Selecciona archivos .apk desde tu PC para instalarlos directamente.</p>
          </div>
        </div>

        <div className={`border-2 border-dashed ${t.dashedBorder} hover:border-emerald-500/50 transition-all duration-200 rounded-xl p-10 flex flex-col items-center justify-center ${t.bg} relative group`}>
          <input
            type="file"
            accept=".apk,.xapk,.apkm"
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              if (files.length === 0) return;
              for (const file of files) {
                addLog(`Instalando ${file.name}...`);
                const formData = new FormData();
                formData.append('file', file);
                if (activeSerial) formData.append('serial', activeSerial);
                try {
                  const res = await fetch('/api/install-apk', { method: 'POST', body: formData });
                  const d = await res.json();
                  addLog(d.success ? `✓ ${d.message}` : `✗ ${d.error}`);
                } catch {
                  addLog(`✗ Error al instalar ${file.name}`);
                }
              }
              e.target.value = '';
            }}
          />
          <div className="flex flex-col items-center transition-all duration-200">
            <div className={`w-16 h-16 rounded-xl ${dark ? 'bg-white/[0.03]' : 'bg-slate-100'} flex items-center justify-center text-white/30 group-hover:text-emerald-500 transition-all duration-200 mb-4 shadow-sm`}>
              <Download className="w-7 h-7" />
            </div>
            <p className="text-base font-bold group-hover:text-emerald-500 transition-colors duration-300">Arrastra archivos APK aquí</p>
            <p className={`text-xs ${t.textSub} mt-1.5 max-w-[250px] text-center`}>
              También puedes hacer clic para seleccionar
            </p>
          </div>
        </div>

        {(!device || !device.connected) && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs text-center">
            Conecta un dispositivo para habilitar la instalación.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Manager Sub-panel ─────────────────────────────────────────────

function ManagerPanel({
  dark, t,
  device,
  appsSearch, setAppsSearch,
  appsFilter, setAppsFilter,
  appsSort, setAppsSort,
  appsViewMode, setAppsViewMode,
  appsLoading, fetchApps,
  filteredApps,
  selectedPackages, togglePackageSelection,
  toggleSelectAllFiltered,
  handleBulkUninstall,
  appActionLoading,
  handleAppUninstall, handleAppEnable, handleAppDisable,
}: {
  dark: boolean;
  t: Record<string, string>;
  device: { connected: boolean } | null;
  appsSearch: string;
  setAppsSearch: (v: string) => void;
  appsFilter: string;
  setAppsFilter: (v: string) => void;
  appsSort: string;
  setAppsSort: (v: string) => void;
  appsViewMode: string;
  setAppsViewMode: (v: string) => void;
  filteredApps: AppInfo[];
  appsLoading: boolean;
  fetchApps: () => Promise<void>;
  selectedPackages: Set<string>;
  togglePackageSelection: (pkg: string) => void;
  toggleSelectAllFiltered: (list: AppInfo[]) => void;
  handleBulkUninstall: () => Promise<void>;
  appActionLoading: string | null;
  handleAppUninstall: (pkg: string) => Promise<void>;
  handleAppEnable: (pkg: string) => Promise<void>;
  handleAppDisable: (pkg: string) => Promise<void>;
}) {
  if (!device || !device.connected) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-3xl mt-5">
        <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-10 text-center`}>
          <Smartphone size={36} className={`mx-auto mb-4 ${dark ? 'text-white/30' : 'text-slate-400'}`} />
          <p className={`font-bold text-sm ${t.textMuted} mb-2`}>Conecta un dispositivo para gestionar aplicaciones</p>
          <p className={`text-xs ${t.textSub}`}>La administración de apps requiere un dispositivo Android conectado vía ADB.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 mt-5 space-y-5">

      {/* Toolbar */}
      <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-3`}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <Input
              hideLabel
              label="Buscar aplicación"
              placeholder="Buscar aplicación..."
              value={appsSearch}
              onChange={(e) => setAppsSearch(e.target.value)}
              icon={<Search size={14} />}
            />
          </div>

          {/* Filter */}
          <select
            value={appsFilter}
            onChange={(e) => setAppsFilter(e.target.value)}
            className={`px-3 py-2 text-sm rounded-xl border ${dark ? 'bg-[#0a0c17] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'} outline-none`}
          >
            <option value="all">Todas</option>
            <option value="user">👤 Usuario</option>
            <option value="system">⚙️ Sistema</option>
            <option value="safe">✅ Seguras para quitar</option>
            <option value="bloatware">🗑️ Bloatware</option>
            <option value="google">Google</option>
            <option value="disabled">Deshabilitadas</option>
            <option value="hidden">Ocultas</option>
            <option value="adware">Con overlay</option>
            <option value="malware">⚠️ Amenazas</option>
            <option value="critical">🔒 Críticas (NO quitar)</option>
          </select>

          {/* Sort */}
          <select
            value={appsSort}
            onChange={(e) => setAppsSort(e.target.value)}
            className={`px-3 py-2 text-sm rounded-xl border ${dark ? 'bg-[#0a0c17] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'} outline-none`}
          >
            <option value="name_asc">Nombre A-Z</option>
            <option value="name_desc">Nombre Z-A</option>
            <option value="date_desc">Más recientes</option>
            <option value="date_asc">Más antiguas</option>
            <option value="size_desc">Más pesadas</option>
            <option value="size_asc">Más ligeras</option>
          </select>

          {/* View mode */}
          <div className={`flex items-center gap-1 p-1 rounded-xl ${dark ? 'bg-white/[0.05] border border-white/5' : 'bg-slate-100 border border-slate-200'}`}>
            <Button variant="ghost" size="sm" aria-label="Vista cuadrícula" onClick={() => setAppsViewMode('grid')} className={`${appsViewMode === 'grid' ? 'bg-brand/20 text-brand-light' : ''} p-1.5 h-auto`}>
              <LayoutGrid size={14} />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Vista lista" onClick={() => setAppsViewMode('list')} className={`${appsViewMode === 'list' ? 'bg-brand/20 text-brand-light' : ''} p-1.5 h-auto`}>
              <List size={14} />
            </Button>
          </div>

          {/* Refresh */}
          <Button variant="secondary" size="sm" aria-label="Actualizar" onClick={fetchApps} disabled={appsLoading} className="px-2.5">
            <RefreshCw size={14} className={appsLoading ? 'animate-spin' : ''} />
          </Button>
        </div>

        {/* Bulk actions */}
        {selectedPackages.size > 0 && (
          <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-white/5">
            <span className={`text-xs font-bold ${dark ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-600 bg-emerald-50'} px-2.5 py-1 rounded-lg`}>
              {selectedPackages.size} seleccionadas
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => toggleSelectAllFiltered(filteredApps)}
            >
              {filteredApps.every(a => selectedPackages.has(a.packageName)) ? 'Deseleccionar todas' : 'Seleccionar todas'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={10} />}
              onClick={handleBulkUninstall}
            >
              Desinstalar seleccionadas
            </Button>
          </div>
        )}
      </div>

      {/* App list */}
      {appsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Sparkles size={24} className="animate-spin text-emerald-500" />
          <span className={`ml-3 text-sm ${t.textMuted}`}>Cargando aplicaciones...</span>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-10 text-center`}>
          <Search size={36} className={`mx-auto mb-3 ${dark ? 'text-white/20' : 'text-slate-300'}`} />
          <p className={`font-bold text-sm ${t.textMuted}`}>No se encontraron aplicaciones</p>
        </div>
      ) : appsViewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
          {filteredApps.map((app, idx) => (
            <AppCard key={app.packageName ? `${app.packageName}-${idx}` : `app-${idx}`}
              app={app} dark={dark}
              selected={selectedPackages.has(app.packageName)}
              onToggleSelect={() => togglePackageSelection(app.packageName)}
              onUninstall={() => handleAppUninstall(app.packageName)}
              onDisable={() => handleAppDisable(app.packageName)}
              onEnable={() => handleAppEnable(app.packageName)}
              actionLoading={appActionLoading === app.packageName}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredApps.map((app, idx) => (
            <AppRow key={app.packageName ? `${app.packageName}-${idx}` : `app-${idx}`}
              app={app} dark={dark}
              selected={selectedPackages.has(app.packageName)}
              onToggleSelect={() => togglePackageSelection(app.packageName)}
              onUninstall={() => handleAppUninstall(app.packageName)}
              onDisable={() => handleAppDisable(app.packageName)}
              onEnable={() => handleAppEnable(app.packageName)}
              actionLoading={appActionLoading === app.packageName}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── App Card (grid view) ───────────────────────────────────────────

function AppCard({
  app, dark, selected, onToggleSelect,
  onUninstall, onDisable, onEnable, actionLoading,
}: {
  app: AppInfo;
  dark: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onUninstall: () => void;
  onDisable: () => void;
  onEnable: () => void;
  actionLoading: boolean;
}) {
  return (
    <div className={`relative rounded-xl border p-2.5 flex flex-col gap-1.5 transition-all ${
      selected
        ? (dark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-300')
        : (dark ? 'bg-[#0c0d18] border-white/5 hover:bg-white/[0.02]' : 'bg-white border-slate-200 hover:bg-slate-50')
    }`}>
      {/* Select checkbox */}
      <button onClick={onToggleSelect} className={`absolute top-2 right-2 w-5 h-5 min-h-0 rounded-md border flex items-center justify-center ${dark ? 'border-white/20 bg-white/[0.03]' : 'border-slate-300 bg-white'}`}>
        {selected && <CheckIcon />}
      </button>

      <AppIcon app={app} dark={dark} />
      <p className="text-xs font-bold truncate" title={app.name}>{app.name || app.packageName}</p>
      <p className={`text-[10px] font-mono ${dark ? 'text-white/30' : 'text-slate-400'} truncate`}>{app.packageName}</p>

      {/* Safety badges */}
      <div className="flex items-center gap-1 flex-wrap">
        {app.safeToRemove && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
            ✅ SEGURO
          </span>
        )}
        {app.criticalSystem && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold border border-red-500/20">
            🔒 CRÍTICO
          </span>
        )}
        {app.isBloatware && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-bold border border-orange-500/20">
            🗑️ BLOAT
          </span>
        )}
        {app.isMalware && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-600/10 text-red-500 font-bold border border-red-600/20">
            ⚠️ AMENAZA
          </span>
        )}
        {app.isDisabled && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 font-bold border border-slate-500/20">
            DESACTIVADA
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-auto pt-1.5 border-t border-white/5">
        <span className={`text-[10px] ${dark ? 'text-white/40' : 'text-slate-500'}`}>{formatBytes(app.size)}</span>
      </div>

{/* Actions */}
      <div className="flex gap-1">
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 size={10} />}
          className="flex-1 px-1"
          disabled={actionLoading}
          onClick={onUninstall}
        >
          Desinstalar
        </Button>
        {app.isDisabled ? (
          <Button
            variant="primary"
            size="sm"
            icon={<Eye size={10} />}
            className="flex-1 px-1"
            disabled={actionLoading}
            onClick={onEnable}
          >
            Habilitar
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            icon={<EyeOff size={10} />}
            className="flex-1 px-1"
            disabled={actionLoading}
            onClick={onDisable}
          >
            Deshab.
          </Button>
        )}
      </div>
    </div>
  );
}

// ── App Row (list view) ────────────────────────────────────────────

function AppRow({
  app, dark, selected, onToggleSelect,
  onUninstall, onDisable, onEnable, actionLoading,
}: {
  app: AppInfo;
  dark: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onUninstall: () => void;
  onDisable: () => void;
  onEnable: () => void;
  actionLoading: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
      selected
        ? (dark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-300')
        : (dark ? 'bg-[#0c0d18] border-white/5 hover:bg-white/[0.02]' : 'bg-white border-slate-200 hover:bg-slate-50')
    }`}>
      <button onClick={onToggleSelect} className={`w-5 h-5 min-h-0 rounded-md border flex items-center justify-center shrink-0 ${dark ? 'border-white/20 bg-white/[0.03]' : 'border-slate-300 bg-white'}`}>
        {selected && <CheckIcon />}
      </button>
      <AppIcon app={app} dark={dark} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{app.name || app.packageName}</p>
        <p className={`text-[10px] font-mono ${dark ? 'text-white/30' : 'text-slate-400'} truncate`}>{app.packageName}</p>
        {/* Safety badges row */}
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          {app.safeToRemove && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
              ✅ SEGURO
            </span>
          )}
          {app.criticalSystem && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold border border-red-500/20">
              🔒 CRÍTICO
            </span>
          )}
          {app.isBloatware && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-bold border border-orange-500/20">
              🗑️ BLOAT
            </span>
          )}
          {app.isMalware && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-600/10 text-red-500 font-bold border border-red-600/20">
              ⚠️ AMENAZA
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-[10px] ${dark ? 'text-white/40' : 'text-slate-500'}`}>{formatBytes(app.size)}</span>
        <span className={`text-[10px] ${dark ? 'text-white/30' : 'text-slate-400'}`}>{formatDate(app.date)}</span>
        {app.isDisabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-bold">DESACTIVADA</span>}
<Button
          variant="danger"
          size="sm"
          icon={<Trash2 size={10} />}
          disabled={actionLoading}
          onClick={onUninstall}
        >
          Desinstalar
        </Button>
        {app.isDisabled ? (
          <Button
            variant="primary"
            size="sm"
            icon={<Eye size={10} />}
            disabled={actionLoading}
            onClick={onEnable}
          >
            Habilitar
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            icon={<EyeOff size={10} />}
            disabled={actionLoading}
            onClick={onDisable}
          >
            Deshab.
          </Button>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2 5L4 7L8 3" stroke="#22c97d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
