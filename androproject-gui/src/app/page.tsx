'use client';

import React from 'react';
import { AppShell } from '../components/layout/AppShell';

import { DashboardView } from '../features/DashboardView';
import { ProjectionView } from '../features/ProjectionView';
import { AppsView } from '../features/AppsView';
import { FlasherView } from '../features/FlasherView';
import { CurarView } from '../features/CurarView';
import { ArchivosView } from '../features/ArchivosView';
import { ToolsView } from '../features/ToolsView';
import { OptimizerView } from '../features/OptimizerView';
import { ConfigView } from '../features/ConfigView';

import { useAppStore } from '../stores';
import { useDevicePolling } from '../hooks/useDevicePolling';
import { useAdbConnection } from '../hooks/useAdbConnection';
import { useSystemLogs } from '../hooks/useSystemLogs';
import type { NavSection, DeviceInfo } from '../features/types';

/* ── ActiveViewRouter: Open/Closed — add views without touching layout ── */
function ActiveView({
  nav, device, addLog, onNavigate,
}: {
  nav: NavSection;
  device: DeviceInfo | null;
  addLog: (msg: string, t?: 'info' | 'success' | 'error') => void;
  onNavigate: (n: NavSection) => void;
}) {
  switch (nav) {
    case 'dashboard':  return <DashboardView device={device} addLog={addLog} onNavigate={onNavigate} />;
    case 'projection': return <ProjectionView device={device} />;

    case 'apps':       return <AppsView device={device} addLog={addLog} />;
    case 'flasher':    return <FlasherView device={device} addLog={addLog} />;
    case 'curar':      return <CurarView device={device} addLog={addLog} />;
    case 'archivos':   return <ArchivosView device={device} addLog={addLog} />;
    case 'tools':      return <ToolsView device={device} />;
    case 'optimizer':  return <OptimizerView device={device} addLog={addLog} />;
    case 'config':     return <ConfigView addLog={addLog} />;
    default:           return <DashboardView device={device} addLog={addLog} onNavigate={onNavigate} />;
  }
}

export default function Page() {
  const activeNav = useAppStore((s) => s.activeNav) ?? 'dashboard';

  const setActiveNav = useAppStore((s) => s.setActiveNav);
  const { devices, device, selectedSerial, setSelectedSerial, isScanning, scanRadar, refresh } = useDevicePolling();
  const { logs, addLog, clearLogs } = useSystemLogs();
  const adb = useAdbConnection();

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const requestedNav = params.get('nav') as NavSection | null;
      if (requestedNav && ['projection', 'dashboard', 'apps', 'flasher', 'curar', 'archivos', 'tools', 'optimizer', 'config'].includes(requestedNav)) {
        setActiveNav(requestedNav);
      }
    }
  }, [setActiveNav]);

  return (
    <AppShell
      devices={devices}
      selectedSerial={selectedSerial}
      onSelectSerial={setSelectedSerial}
      isScanning={isScanning}
      onScanRadar={scanRadar}
      onRefresh={refresh}
      logs={logs}
      addLog={addLog}
      clearLogs={clearLogs}
      activeNav={activeNav}
      onNavigate={setActiveNav}
      adbServerRunning={adb.serverRunning}
      onToggleAdb={adb.toggleServer}
      isAdbConnecting={adb.isConnecting}
      registeredDevices={adb.registeredDevices}
      onRegisterDevice={adb.registerDevice}
      onUnregisterDevice={adb.unregisterDevice}
      onToggleAutoConnect={adb.toggleAutoConnect}
    >
      <ActiveView nav={activeNav} device={device} addLog={addLog} onNavigate={setActiveNav} />
    </AppShell>
  );
}
