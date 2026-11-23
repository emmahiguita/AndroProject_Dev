// ============================================================================
// ARCHIVO: AppsView.tsx
// QUÉ HACE: Orquestador de Aplicaciones de alta velocidad con actualizaciones
//           optimistas en memoria, caché inteligente y auditoría de amenazas.
// CÓMO FUNCIONA:
//   1. Si `s.appsList` ya tiene datos del dispositivo activo, los muestra al
//      instante (0ms) sin bloquear la pantalla.
//   2. Al desinstalar, habilitar o deshabilitar, actualiza `s.appsList` en
//      memoria de inmediato sin recargar toda la lista por ADB.
// POR QUÉ: Lograr que el módulo Aplicaciones cargue y responda 100% más rápido
//          manteniendo el archivo < 175 líneas (SRP / SOLID).
// ============================================================================

'use client';
import { apiUrl } from '@/lib/api-url';

import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { rustBridge } from '@/lib/services/tauri-bridge';
import { AppInstallerPanel } from './apps/AppInstallerPanel';
import { AppManagerPanel } from './apps/AppManagerPanel';
import {
  filterAndSortApps, formatBytes, formatDate, getErrorMessage, summarizeAppThreats,
} from './apps/app-formatters';
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
  // ADB gestiona Android; un serial iOS o una conexión caída no habilitan la instalación.
  const isConnected = Boolean(device?.connected && device.platform !== 'ios' && targetSerial && targetSerial !== 'Hardware Level');
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean; serial: string | null } | null>(null);
  const loadedSerialRef = useRef<string | null>(null);

  const notify = useCallback((msg: string, isError = false) => {
    setStatusMessage({ text: msg, isError, serial: targetSerial });
    if (propAddLog) propAddLog(msg, isError ? 'error' : 'info');
    else s.addLog(msg);
  }, [propAddLog, s, targetSerial]);

  const fetchApps = useCallback(async (forceRefresh = false) => {
    if (!isConnected || !targetSerial) return;
    s.setAppsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/apps'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', serial: targetSerial, forceRefresh }),
      });
      const data = await res.json();
      if (useAppStore.getState().activeSerial !== targetSerial) return;
      if (data.success && data.apps) { s.setAppsList(data.apps); loadedSerialRef.current = targetSerial; }
      else notify(`Error cargando apps: ${data.error || 'fallo ADB'}`, true);
    } catch (err: unknown) {
      notify(`Error de red cargando apps: ${getErrorMessage(err)}`, true);
    } finally {
      if (useAppStore.getState().activeSerial === targetSerial) s.setAppsLoading(false);
    }
  }, [targetSerial, isConnected, s, notify]);

  useEffect(() => {
    if (!isConnected || !targetSerial) return;
    if (s.appsList.length > 0 && loadedSerialRef.current === targetSerial) return;
    fetchApps(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSerial, isConnected]);

  const applyLocalMutation = useCallback((action: PkgAction, pkgName: string) => {
    const state = useAppStore.getState();
    if (state.activeSerial !== targetSerial) return;
    if (action === 'uninstall') {
      state.setAppsList(state.appsList.filter((a) => a.packageName !== pkgName));
      const selected = new Set(state.selectedPackages);
      if (selected.delete(pkgName)) state.setSelectedPackages(selected);
    }
    else if (action === 'disable' || action === 'enable') {
      const nextDisabled = action === 'disable';
      state.setAppsList(state.appsList.map((a) => (a.packageName === pkgName ? { ...a, isDisabled: nextDisabled } : a)));
    }
  }, [targetSerial]);

  const filteredApps = useMemo(
    () => filterAndSortApps(s.appsList, s.appsSearch, s.appsFilter, s.appsSort),
    [s.appsList, s.appsSearch, s.appsFilter, s.appsSort],
  );

  const runPkgAction = async (action: PkgAction, pkgName: string) => {
    const state = useAppStore.getState();
    if (!targetSerial || state.activeSerial !== targetSerial || state.appActionLoading) return;
    const app = state.appsList.find((a) => a.packageName === pkgName);
    if (!app) return;
    if (app?.criticalSystem && (action === 'uninstall' || action === 'disable' || action === 'clear_data')) {
      notify(`Paquete crítico del sistema protegido: ${pkgName}`, true);
      return;
    }
    s.setAppActionLoading(pkgName);
    try {
      if (action !== 'extract_apk' && rustBridge.isDesktop() && targetSerial && targetSerial !== 'Hardware Level') {
        const rustOut = await rustBridge.appActionFast(targetSerial, pkgName, action);
        if (rustOut !== null && !/Failure|Exception|Error:|No activities found/i.test(rustOut)) {
          applyLocalMutation(action, pkgName);
          const cleanMsg = action === 'launch' && rustOut.trim() ? rustOut.trim() : `[Nativo] ${action} → ${pkgName} completado.`;
          notify(cleanMsg);
          return;
        }
        notify(`No se pudo completar ${action} para ${pkgName}: ${rustOut || 'sin respuesta del servicio nativo'}`, true);
        return;
      }
      const res = await fetch(apiUrl('/api/apps'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, packageName: pkgName, serial: targetSerial }),
      });
      const data = await res.json();
      if (data.success) { applyLocalMutation(action, pkgName); notify(data.message || `Acción ${action} aplicada a ${pkgName}.`); }
      else notify(`Error (${action} en ${pkgName}): ${data.error || 'fallo ADB'}`, true);
    } catch (err: unknown) {
      notify(`Error al ejecutar ${action}: ${getErrorMessage(err)}`, true);
    } finally {
      if (useAppStore.getState().activeSerial === targetSerial) s.setAppActionLoading(null);
    }
  };

  const handleAppUninstall = async (pkgName: string) => { if (confirm(`¿Desinstalar "${pkgName}" del dispositivo?`)) await runPkgAction('uninstall', pkgName); };
  const handleAppClearData = async (pkgName: string) => { if (confirm(`¿Limpiar todos los datos y caché de "${pkgName}"?`)) await runPkgAction('clear_data', pkgName); };

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
    if (targets.length === 0) { notify('Los paquetes seleccionados son críticos del sistema y están protegidos.', true); return; }
    if ((action === 'uninstall' || action === 'disable') && !confirm(`¿Aplicar "${action}" a ${targets.length} aplicaciones seleccionadas?`)) return;
    for (const pkgName of targets) await runPkgAction(action, pkgName);
    // Conserva la selección para que el usuario revise el resultado del lote.
  };

  const handleAuditThreats = () => {
    const { malwareCount, overlayCount, hiddenUserCount, totalSuspect } = summarizeAppThreats(s.appsList);
    if (totalSuspect > 0) {
      s.setAppsFilter('malware');
      notify(`Auditoría: ${malwareCount} amenazas/spyware, ${overlayCount} apps con publicidad Overlay y ${hiddenUserCount} apps ocultas sin icono. Mostrando sospechosas.`, true);
    } else {
      // La lista ADB no incluye un análisis antivirus; no acredita que el dispositivo esté limpio.
      notify('La lista de paquetes no incluye un análisis de malware; no se puede confirmar que el dispositivo esté limpio.', true);
    }
  };

  const tabCls = 'min-h-10 rounded-md border border-transparent px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-overlay aria-pressed:border-border-selected aria-pressed:bg-surface-selected aria-pressed:text-text-selected';

  return (
    <ViewShell navId="apps">
      <div className="mx-auto max-w-[1600px] border-b border-border pb-3">
        <h1 className="mb-3 text-2xl font-bold tracking-tight text-text-primary">Aplicaciones</h1>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Opciones de aplicaciones">
          <button type="button" aria-pressed={s.appsSubTab === 'manager'} onClick={() => s.setAppsSubTab('manager')} className={tabCls}>Administrar aplicaciones ({s.appsList.length})</button>
          <button type="button" aria-pressed={s.appsSubTab === 'installer'} onClick={() => s.setAppsSubTab('installer')} className={tabCls}>Instalar APK</button>
        </div>
      </div>

      {s.appsSubTab === 'installer' ? (
        <AppInstallerPanel dark={dark} addLog={(m) => notify(m)} activeSerial={targetSerial} connected={isConnected} onInstalled={() => fetchApps(true)} />
      ) : (
        <AppManagerPanel
          dark={dark} connected={isConnected} serial={targetSerial || undefined} totalCount={s.appsList.length} statusMessage={statusMessage?.serial === targetSerial ? statusMessage : null}
          appsSearch={s.appsSearch} setAppsSearch={s.setAppsSearch} appsFilter={s.appsFilter} setAppsFilter={(v) => (s.setAppsFilter as (x: unknown) => void)(v)}
          appsSort={s.appsSort} setAppsSort={s.setAppsSort} appsViewMode={s.appsViewMode} setAppsViewMode={(v) => (s.setAppsViewMode as (x: unknown) => void)(v)}
          appsLoading={s.appsLoading} fetchApps={() => fetchApps(true)} filteredApps={filteredApps}
          selectedPackages={s.selectedPackages} togglePackageSelection={s.togglePackageSelection}
          toggleSelectAllFiltered={toggleSelectAllFiltered} onAuditThreats={handleAuditThreats}
          handleBulkAction={handleBulkAction} appActionLoading={s.appActionLoading}
          handleAppLaunch={(p) => runPkgAction('launch', p)} handleAppForceStop={(p) => runPkgAction('force_stop', p)}
          handleAppClearData={handleAppClearData} handleAppExtractApk={(p) => runPkgAction('extract_apk', p)}
          handleAppUninstall={handleAppUninstall} handleAppEnable={(p) => runPkgAction('enable', p)} handleAppDisable={(p) => runPkgAction('disable', p)}
        />
      )}
    </ViewShell>
  );
}
