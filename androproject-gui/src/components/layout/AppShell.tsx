'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { SystemTerminal } from './SystemTerminal';
import { WirelessConnectModal } from './WirelessConnectModal';
import { useAppTheme } from '../ThemeProvider';
import { useMouseLight } from '../../hooks/useMouseLight';
import type { DeviceInfo, SystemLogs, NavSection } from '@/features/types';
import type { RegisteredDevice } from '../../hooks/useAdbConnection';

/* ── Breakpoints ── */
const BP_MED = 1050;

interface AppShellProps {
  devices: DeviceInfo[];
  selectedSerial: string;
  onSelectSerial: (s: string) => void;
  isScanning: boolean;
  onScanRadar: () => void;
  onRefresh: () => void;
  logs: SystemLogs[];
  addLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
  clearLogs: () => void;
  activeNav: NavSection;
  onNavigate: (n: NavSection) => void;
  children: React.ReactNode;
  /** ADB connection state */
  adbServerRunning?: boolean;
  onToggleAdb?: () => void;
  isAdbConnecting?: boolean;
  registeredDevices?: RegisteredDevice[];
  onRegisterDevice?: (serial: string, model: string, connectionType: 'USB' | 'Wi-Fi', ip?: string, port?: string) => void;
  onUnregisterDevice?: (serial: string) => void;
  onToggleAutoConnect?: (serial: string) => void;
}

/**
 * AppShell — Simple responsive layout: sidebar + main content.
 * Projection is now a full-page view accessed via sidebar nav.
 */
export const AppShell: React.FC<AppShellProps> = ({
  devices, selectedSerial, onSelectSerial, isScanning, onScanRadar, onRefresh,
  logs, addLog, clearLogs,
  activeNav, onNavigate,
  children,
  adbServerRunning = false, onToggleAdb, isAdbConnecting = false,
  registeredDevices = [], onRegisterDevice, onUnregisterDevice, onToggleAutoConnect,
}) => {
  const { isDark } = useAppTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [connectModal, setConnectModal] = useState(false);
  const [viewportMedium, setViewportMedium] = useState(true);
  const sceneRef = useRef<HTMLDivElement>(null);

  // Cosmic 3D: dynamic lighting follows cursor
  useMouseLight(sceneRef);

  useEffect(() => {
    const check = () => setViewportMedium(window.innerWidth >= BP_MED);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!viewportMedium) setSidebarOpen(false);
  }, [viewportMedium]);

  return (
    <div ref={sceneRef} className={`relative flex h-screen w-screen overflow-hidden ${isDark ? 'bg-[#070913] text-[#e2e8f0]' : 'bg-slate-50 text-slate-900'}`}>
      {/* ═══ COSMIC 3D BACKGROUND ═══ */}
      {isDark && (
        <>
          <div className="cosmic-starfield" />
          <div className="cosmic-fog" />
          <div className="cosmic-light" />
        </>
      )}

      {/* ═══ SIDEBAR / DRAWER ═══ */}
      {viewportMedium ? (
        <Sidebar
          activeNav={activeNav}
          onSelectNav={onNavigate}
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen(p => !p)}
        />
      ) : (
        sidebarOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setSidebarOpen(false)} />
            <div className="relative z-10 h-full shadow-2xl">
              <Sidebar activeNav={activeNav} onSelectNav={(n) => { onNavigate(n); setSidebarOpen(false); }} />
            </div>
          </div>
        )
      )}

      {/* ═══ MAIN COLUMN ═══ */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Header
          devices={devices}
          selectedSerial={selectedSerial}
          onSelectSerial={onSelectSerial}
          onScanRadar={onScanRadar}
          onOpenConnectModal={() => setConnectModal(true)}
          isScanning={isScanning}
          onRefresh={onRefresh}
          onToggleSidebar={() => setSidebarOpen(p => !p)}
          sidebarOpen={sidebarOpen}
          projectionActive={activeNav === 'projection'}
          onNavigateProjection={() => onNavigate('projection')}
          adbServerRunning={adbServerRunning}
          onToggleAdb={onToggleAdb}
          isAdbConnecting={isAdbConnecting}
          registeredDevices={registeredDevices}
          onRegisterDevice={onRegisterDevice}
          onUnregisterDevice={onUnregisterDevice}
          onToggleAutoConnect={onToggleAutoConnect}
        />

        <main className={`relative flex-1 min-w-0 ${
          activeNav === 'projection' ? 'overflow-hidden p-0' : 'overflow-y-auto custom-scrollbar p-2 md:p-3'
        } ${isDark ? '' : 'bg-white'}`}>
          {/* Cosmic ground glow at bottom of content */}
          {isDark && <div className="cosmic-ground-glow" />}
          {children}
          {activeNav !== 'projection' && activeNav !== 'tools' && <SystemTerminal logs={logs} onClearLogs={clearLogs} />}
        </main>
      </div>

      <WirelessConnectModal
        open={connectModal}
        onClose={() => setConnectModal(false)}
        onConnected={onRefresh}
        addLog={addLog}
      />
    </div>
  );
};
