'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MonitorPlay, X } from 'lucide-react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { WirelessConnectModal } from './WirelessConnectModal';
import { useAppTheme } from '../ThemeProvider';
import { useMouseLight } from '../../hooks/useMouseLight';
import { useRescueSync } from '../../hooks/useRescueSync';
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

  // Rescue Sync hook: keeps designated secondary device (e.g. Galaxy A30) permanently connected
  const rescueSync = useRescueSync(devices, onRefresh);

  // Auto-detection toast state
  const [detectedToast, setDetectedToast] = useState<DeviceInfo | null>(null);
  const prevSerialsRef = useRef<string>('');

  // Detect when new device appears
  useEffect(() => {
    const activeDevs = devices.filter(d => d.state === 'device');
    const currentSerials = activeDevs.map(d => d.serial).join(',');

    if (activeDevs.length > 0 && currentSerials !== prevSerialsRef.current) {
      // Find newly added device
      const newlyAdded = activeDevs.find(d => !prevSerialsRef.current.includes(d.serial)) || activeDevs[0];
      setDetectedToast(newlyAdded);
    }
    prevSerialsRef.current = currentSerials;
  }, [devices]);

  // Launch scrcpy and switch to projection
  const handleConfirmTransmit = async () => {
    if (!detectedToast) return;
    const targetSerial = detectedToast.serial;
    setDetectedToast(null);
    onSelectSerial(targetSerial);
    onNavigate('projection');

    try {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open_screen',
          serial: targetSerial,
          maxSize: '1080',
          maxFps: '60',
          bitRate: '16M',
          stayAwake: true,
          alwaysOnTop: true,
        }),
      });
      addLog(`Transmisión iniciada para ${detectedToast.model}`, 'success');
    } catch {
      addLog(`Error al iniciar transmisión`, 'error');
    }
  };

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
    <div ref={sceneRef} suppressHydrationWarning className={`relative flex h-screen w-screen overflow-hidden ${isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'}`}>
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
          rescueConfig={rescueSync.config}
          rescueStatus={rescueSync.status}
          rescueMsg={rescueSync.lastSyncMsg}
          onToggleRescue={rescueSync.toggleRescueSync}
        />

        {/* ═══ AUTO-DETECTION CONFIRMATION TOAST BANNER ═══ */}
        {detectedToast && activeNav !== 'projection' && (
          <div className="absolute top-14 right-4 z-40 flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-zinc-900/95 border border-zinc-700 text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-white">Dispositivo detectado</p>
              <p className="text-[10px] text-white/50">{detectedToast.model} ({detectedToast.connectionType})</p>
            </div>
            <button
              onClick={handleConfirmTransmit}
              className="px-3 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm shrink-0"
            >
              <MonitorPlay size={12} />
              <span>Transmitir Ahora (60 FPS)</span>
            </button>
            <button
              onClick={() => setDetectedToast(null)}
              className="p-1 text-white/40 hover:text-white transition-colors"
              title="Cerrar notificación"
            >
              <X size={13} />
            </button>
          </div>
        )}

        <main className={`relative flex-1 min-h-0 min-w-0 ${
          activeNav === 'projection'
            ? 'overflow-hidden p-0 flex flex-col'
            : 'overflow-y-auto custom-scrollbar p-2 md:p-3'
        } ${isDark ? '' : 'bg-white'}`}>

          {/* Cosmic ground glow at bottom of content */}
          {isDark && <div className="cosmic-ground-glow" />}
          {children}
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
