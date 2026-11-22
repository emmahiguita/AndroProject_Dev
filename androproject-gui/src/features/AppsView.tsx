// ============================================================================
// ARCHIVO: AppsView.tsx
// QUÉ HACE: Orquestador de Aplicaciones (instalar APK + gestionar paquetes).
// CÓMO FUNCIONA: Carga paquetes desde `/api/apps`, prioriza Rust nativo en
//           Tauri con fallback HTTP y delega UI a AppInstaller/AppManager.
// POR QUÉ: Refactor SRP (< 200 líneas), monocromo, legible claro/oscuro.
// ============================================================================

'use client';

import { useMemo, useCallback, useEffect } from 'react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { rustBridge } from '@/lib/services/tauri-bridge';
import { AppInstallerPanel } from './apps/AppInstallerPanel';
import { AppManagerPanel } from './apps/AppManagerPanel';
import { formatBytes, formatDate, getErrorMessage } from './apps/app-formatters';
import type { AppInfo, DeviceInfo } from './types';

export { formatBytes, formatDate };

interface AppsViewProps {
  device?: DeviceInfo | null;
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function AppsView({ device: propDevice, addLog: propAddLog }: AppsViewProps = {}) {
  const { dark } = useTheme();
  const s = useAppStore();
  const device = propDevice || s.device;

  const log = useCallback(
    (msg: string) => {
      if (propAddLog) propAddLog(msg);
      else s.addLog(msg);
    },
    [propAddLog, s]
  );

  /** Consulta el catálogo real de paquetes instalados en el teléfono conectado. */
  const fetchApps = useCallback(async () => {
    if (!s.activeSerial || s.activeSerial === 'Hardware Level') return;
    s.setAppsLoading(true);
    s.setSelectedPackages(new Set());
    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', serial: s.activeSerial }),
      });
      const data = await res.json();
      if (data.success && data.apps) s.setAppsList(data.apps);
      else log(`Error cargando apps: ${data.error}`);
    } catch (err: unknown) {
      log(`Error de red cargando apps: ${getErrorMessage(err)}`);
    } finally {
      s.setAppsLoading(false);
    }
  }, [s, log]);

  useEffect(() => {
    if (s.appsSubTab === 'manager' && s.activeSerial && s.activeSerial !== 'Hardware Level') {
      fetchApps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.appsSubTab, s.activeSerial]);

  /** Aplica búsqueda, categoría y orden sobre la lista real de paquetes. */
  const filteredApps = useMemo(() => {
    const q = s.appsSearch.toLowerCase();
    const filtered = s.appsList.filter((app) => {
      if (q && !app.name.toLowerCase().includes(q) && !app.packageName.toLowerCase().includes(q)) return false;
      if (s.appsFilter === 'system') return app.isSystem || app.isBloatware;
      if (s.appsFilter === 'user') return !app.isSystem;
      if (s.appsFilter === 'hidden') return app.isHidden;
      if (s.appsFilter === 'adware') return app.hasOverlay;
      if (s.appsFilter === 'disabled') return app.isDisabled;
      if (s.appsFilter === 'google') return app.isGoogle;
      if (s.appsFilter === 'malware') return app.isMalware;
      if (s.appsFilter === 'bloatware') return app.isBloatware;
      if (s.appsFilter === 'safe') return app.safeToRemove;
      if (s.appsFilter === 'critical') return app.criticalSystem;
      return true;
    });
    return filtered.sort((a, b) => {
      if (s.appsSort === 'name_asc') return a.name.localeCompare(b.name);
      if (s.appsSort === 'name_desc') return b.name.localeCompare(a.name);
      if (s.appsSort === 'date_desc') return (b.date || 0) - (a.date || 0);
      if (s.appsSort === 'date_asc') return (a.date || 0) - (b.date || 0);
      if (s.appsSort === 'size_desc') return (b.size || 0) - (a.size || 0);
      if (s.appsSort === 'size_asc') return (a.size || 0) - (b.size || 0);
      return 0;
    });
  }, [s.appsList, s.appsSearch, s.appsFilter, s.appsSort]);

  /** Ejecuta una acción sobre un paquete usando Rust nativo si está en Tauri o API web. */
  const runPkgAction = async (action: 'uninstall' | 'disable' | 'enable', pkgName: string, refresh = true) => {
    s.setAppActionLoading(pkgName);
    try {
      if (rustBridge.isDesktop() && s.activeSerial && s.activeSerial !== 'Hardware Level') {
        const rustOut = await rustBridge.appActionFast(s.activeSerial, pkgName, action);
        if (rustOut !== null) {
          log(`[Rust] ${action} ${pkgName}: ${rustOut.trim() || 'OK'}`);
          if (refresh) fetchApps();
          return;
        }
      }
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, packageName: pkgName, serial: s.activeSerial }),
      });
      const data = await res.json();
      if (data.success) { log(data.message); if (refresh) fetchApps(); }
      else log(`Error (${action}): ${data.error}`);
    } catch (err: unknown) {
      log(`Error de red: ${getErrorMessage(err)}`);
    } finally {
      s.setAppActionLoading(null);
    }
  };

  const handleAppUninstall = async (pkgName: string) => {
    const app = s.appsList.find((a) => a.packageName === pkgName);
    const msg = app?.criticalSystem
      ? `Peligro: "${pkgName}" es crítica del sistema. ¿Desinstalar de todas formas?`
      : `¿Desinstalar "${pkgName}"?`;
    if (!confirm(msg)) return;
    await runPkgAction('uninstall', pkgName);
  };

  const toggleSelectAllFiltered = (list: AppInfo[]) => {
    const names = list.map((a) => a.packageName);
    const allSel = names.every((n) => s.selectedPackages.has(n));
    const next = new Set(s.selectedPackages);
    if (allSel) names.forEach((n) => next.delete(n));
    else names.forEach((n) => next.add(n));
    s.setSelectedPackages(next);
  };

  const handleBulkUninstall = async () => {
    if (s.selectedPackages.size === 0) return;
    const criticalSet = new Set(s.appsList.filter((a) => a.criticalSystem).map((a) => a.packageName));
    const safeTargets = Array.from(s.selectedPackages).filter((p) => !criticalSet.has(p));
    if (safeTargets.length === 0) {
      log('Los paquetes seleccionados son críticos del sistema y están protegidos.');
      return;
    }
    if (!confirm(`¿Desinstalar ${safeTargets.length} aplicaciones seleccionadas?`)) return;
    s.setAppsLoading(true);
    for (const pkgName of safeTargets) await runPkgAction('uninstall', pkgName, false);
    s.setSelectedPackages(new Set());
    await fetchApps();
  };

  const tabCls = (active: boolean) =>
    `pb-2 text-sm font-semibold transition-colors ${
      active
        ? dark ? 'text-zinc-100 border-b-2 border-zinc-100' : 'text-slate-900 border-b-2 border-slate-900'
        : dark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-500 hover:text-slate-800'
    }`;

  return (
    <ViewShell navId="apps">
      <div className={`flex gap-6 overflow-x-auto border-b pb-2 ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
        <button type="button" onClick={() => s.setAppsSubTab('installer')} className={tabCls(s.appsSubTab === 'installer')}>
          Instalar APK
        </button>
        <button type="button" onClick={() => s.setAppsSubTab('manager')} className={tabCls(s.appsSubTab === 'manager')}>
          Administrar Aplicaciones
        </button>
      </div>

      {s.appsSubTab === 'installer' ? (
        <AppInstallerPanel dark={dark} addLog={log} activeSerial={s.activeSerial} connected={Boolean(device?.connected)} />
      ) : (
        <AppManagerPanel
          dark={dark}
          connected={Boolean(device?.connected)}
          serial={device?.serial || s.activeSerial || undefined}
          appsSearch={s.appsSearch} setAppsSearch={s.setAppsSearch}
          appsFilter={s.appsFilter} setAppsFilter={(v) => (s.setAppsFilter as (x: unknown) => void)(v)}
          appsSort={s.appsSort} setAppsSort={s.setAppsSort}
          appsViewMode={s.appsViewMode} setAppsViewMode={(v) => (s.setAppsViewMode as (x: unknown) => void)(v)}
          appsLoading={s.appsLoading} fetchApps={fetchApps} filteredApps={filteredApps}
          selectedPackages={s.selectedPackages} togglePackageSelection={s.togglePackageSelection}
          toggleSelectAllFiltered={toggleSelectAllFiltered} handleBulkUninstall={handleBulkUninstall}
          appActionLoading={s.appActionLoading}
          handleAppUninstall={handleAppUninstall}
          handleAppEnable={(p) => runPkgAction('enable', p)}
          handleAppDisable={(p) => runPkgAction('disable', p)}
        />
      )}
    </ViewShell>
  );
}
