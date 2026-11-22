// ============================================================================
// ARCHIVO: AppsView.tsx
// QUÉ HACE: Orquestador de Aplicaciones (administrar paquetes + instalar APK/IPA).
// CÓMO FUNCIONA: Resuelve el serial real (`device?.serial || s.activeSerial`),
//           ejecuta las acciones ADB (`list`, `launch`, `force_stop`,
//           `clear_data`, `extract_apk`, `enable`, `disable`, `uninstall`),
//           protege paquetes críticos y actualiza el catálogo de inmediato.
// POR QUÉ: Garantizar que todos los botones del módulo Aplicaciones tengan
//          lógica real verificada y feedback inmediato (< 195 líneas, SRP).
// ============================================================================

'use client';

import { useMemo, useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { rustBridge } from '@/lib/services/tauri-bridge';
import { AppInstallerPanel } from './apps/AppInstallerPanel';
import { AppManagerPanel } from './apps/AppManagerPanel';
import { filterAndSortApps, formatBytes, formatDate, getErrorMessage } from './apps/app-formatters';
import type { AppInfo, DeviceInfo } from './types';

export { formatBytes, formatDate };

type PkgAction = 'uninstall' | 'disable' | 'enable' | 'force_stop' | 'clear_data' | 'launch' | 'extract_apk';

interface AppsViewProps {
  device?: DeviceInfo | null;
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function AppsView({ device: propDevice, addLog: propAddLog }: AppsViewProps = {}) {
  const { dark } = useTheme();
  const s = useAppStore();
  const device = propDevice || s.device;
  const targetSerial = device?.serial || s.activeSerial;
  const isConnected = Boolean(device?.connected || (targetSerial && targetSerial !== 'Hardware Level'));
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const notify = useCallback(
    (msg: string, isError = false) => {
      setStatusMessage({ text: msg, isError });
      if (propAddLog) propAddLog(msg, isError ? 'error' : 'info');
      else s.addLog(msg);
    },
    [propAddLog, s],
  );

  const fetchApps = useCallback(async () => {
    if (!targetSerial || targetSerial === 'Hardware Level') return;
    s.setAppsLoading(true);
    s.setSelectedPackages(new Set());
    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', serial: targetSerial }),
      });
      const data = await res.json();
      if (data.success && data.apps) s.setAppsList(data.apps);
      else notify(`Error cargando apps: ${data.error || 'fallo ADB'}`, true);
    } catch (err: unknown) {
      notify(`Error de red cargando apps: ${getErrorMessage(err)}`, true);
    } finally {
      s.setAppsLoading(false);
    }
  }, [targetSerial, s, notify]);

  useEffect(() => {
    if (targetSerial && targetSerial !== 'Hardware Level') fetchApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSerial]);

  const filteredApps = useMemo(
    () => filterAndSortApps(s.appsList, s.appsSearch, s.appsFilter, s.appsSort),
    [s.appsList, s.appsSearch, s.appsFilter, s.appsSort],
  );

  const runPkgAction = async (action: PkgAction, pkgName: string, refresh = true) => {
    const app = s.appsList.find((a) => a.packageName === pkgName);
    if (app?.criticalSystem && (action === 'uninstall' || action === 'disable' || action === 'clear_data')) {
      notify(`Paquete crítico del sistema protegido: ${pkgName}`, true);
      return;
    }
    s.setAppActionLoading(pkgName);
    try {
      if (action !== 'extract_apk' && rustBridge.isDesktop() && targetSerial && targetSerial !== 'Hardware Level') {
        const rustOut = await rustBridge.appActionFast(targetSerial, pkgName, action);
        if (rustOut !== null && !/Failure|Exception|Error:/i.test(rustOut)) {
          notify(`[Nativo] ${action} → ${pkgName} completado.`);
          if (refresh && (action === 'uninstall' || action === 'disable' || action === 'enable')) await fetchApps();
          return;
        }
      }
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, packageName: pkgName, serial: targetSerial }),
      });
      const data = await res.json();
      if (data.success) {
        notify(data.message || `Acción ${action} aplicada a ${pkgName}.`);
        if (refresh && (action === 'uninstall' || action === 'disable' || action === 'enable')) await fetchApps();
      } else {
        notify(`Error (${action} en ${pkgName}): ${data.error || 'fallo ADB'}`, true);
      }
    } catch (err: unknown) {
      notify(`Error de red: ${getErrorMessage(err)}`, true);
    } finally {
      s.setAppActionLoading(null);
    }
  };

  const handleAppUninstall = async (pkgName: string) => {
    if (!confirm(`¿Desinstalar "${pkgName}" del dispositivo?`)) return;
    await runPkgAction('uninstall', pkgName);
  };

  const handleAppClearData = async (pkgName: string) => {
    if (!confirm(`¿Limpiar todos los datos y caché de "${pkgName}"?`)) return;
    await runPkgAction('clear_data', pkgName, false);
  };

  const toggleSelectAllFiltered = (list: AppInfo[]) => {
    const names = list.map((a) => a.packageName);
    const allSel = names.length > 0 && names.every((n) => s.selectedPackages.has(n));
    const next = new Set(s.selectedPackages);
    names.forEach((n) => (allSel ? next.delete(n) : next.add(n)));
    s.setSelectedPackages(next);
  };

  const handleBulkAction = async (action: 'uninstall' | 'disable' | 'enable' | 'force_stop') => {
    if (s.selectedPackages.size === 0) return;
    const criticalSet = new Set(s.appsList.filter((a) => a.criticalSystem).map((a) => a.packageName));
    const targets = Array.from(s.selectedPackages).filter((p) => action === 'enable' || action === 'force_stop' || !criticalSet.has(p));
    if (targets.length === 0) {
      notify('Los paquetes seleccionados son críticos del sistema y están protegidos.', true);
      return;
    }
    if ((action === 'uninstall' || action === 'disable') && !confirm(`¿Aplicar "${action}" a ${targets.length} aplicaciones seleccionadas?`)) return;
    s.setAppsLoading(true);
    for (const pkgName of targets) await runPkgAction(action, pkgName, false);
    s.setSelectedPackages(new Set());
    if (action !== 'force_stop') await fetchApps();
    else s.setAppsLoading(false);
  };

  const tabCls = (active: boolean) =>
    `pb-2 text-sm font-semibold transition-colors ${
      active
        ? dark ? 'text-zinc-100 border-b-2 border-zinc-100' : 'text-slate-900 border-b-2 border-slate-900'
        : dark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-500 hover:text-slate-800'
    }`;

  return (
    <ViewShell navId="apps">
      <div className={`flex items-center justify-between gap-4 border-b pb-2 ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
        <div className="flex gap-6 overflow-x-auto">
          <button type="button" onClick={() => s.setAppsSubTab('manager')} className={tabCls(s.appsSubTab === 'manager')}>
            Administrar Aplicaciones ({s.appsList.length})
          </button>
          <button type="button" onClick={() => s.setAppsSubTab('installer')} className={tabCls(s.appsSubTab === 'installer')}>
            Instalar APK / IPA
          </button>
        </div>
      </div>

      {s.appsSubTab === 'installer' ? (
        <AppInstallerPanel dark={dark} addLog={(m) => notify(m)} activeSerial={targetSerial} connected={isConnected} onInstalled={fetchApps} />
      ) : (
        <AppManagerPanel
          dark={dark} connected={isConnected} serial={targetSerial || undefined}
          totalCount={s.appsList.length} statusMessage={statusMessage}
          appsSearch={s.appsSearch} setAppsSearch={s.setAppsSearch}
          appsFilter={s.appsFilter} setAppsFilter={(v) => (s.setAppsFilter as (x: unknown) => void)(v)}
          appsSort={s.appsSort} setAppsSort={s.setAppsSort}
          appsViewMode={s.appsViewMode} setAppsViewMode={(v) => (s.setAppsViewMode as (x: unknown) => void)(v)}
          appsLoading={s.appsLoading} fetchApps={fetchApps} filteredApps={filteredApps}
          selectedPackages={s.selectedPackages} togglePackageSelection={s.togglePackageSelection}
          toggleSelectAllFiltered={toggleSelectAllFiltered} handleBulkAction={handleBulkAction}
          appActionLoading={s.appActionLoading}
          handleAppLaunch={(p) => runPkgAction('launch', p, false)}
          handleAppForceStop={(p) => runPkgAction('force_stop', p, false)}
          handleAppClearData={handleAppClearData}
          handleAppExtractApk={(p) => runPkgAction('extract_apk', p, false)}
          handleAppUninstall={handleAppUninstall}
          handleAppEnable={(p) => runPkgAction('enable', p)}
          handleAppDisable={(p) => runPkgAction('disable', p)}
        />
      )}
    </ViewShell>
  );
}
