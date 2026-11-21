// ============================================================================
// ARCHIVO: AppShell.tsx
// QUÉ HACE: Shell principal responsivo: barra lateral + cabecera de control +
//           área de contenido principal y modales de conexión.
// CÓMO FUNCIONA: Orquesta la navegación, el tema visual, la detección de nuevos
//           dispositivos y el estado de la transmisión scrcpy/WebCodecs.
// POR QUÉ: Punto de entrada unificado para todas las vistas con soporte móvil y desktop.
// ============================================================================
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { WirelessConnectModal } from './WirelessConnectModal';
import { AutoDetectionToast } from './AutoDetectionToast';
import { useStreamTracker } from './useStreamTracker';
import { useAppTheme } from '../ThemeProvider';
import { useRescueSync } from '../../hooks/useRescueSync';
import type { DeviceInfo, SystemLogs, NavSection } from '@/features/types';
import type { RegisteredDevice } from '../../hooks/useAdbConnection';

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
  adbServerRunning?: boolean;
  onToggleAdb?: () => void;
  isAdbConnecting?: boolean;
  registeredDevices?: RegisteredDevice[];
  onRegisterDevice?: (serial: string, model: string, type: 'USB' | 'Wi-Fi', ip?: string, port?: string) => void;
  onUnregisterDevice?: (serial: string) => void;
  onToggleAutoConnect?: (serial: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  devices, selectedSerial, onSelectSerial, isScanning, onScanRadar, onRefresh,
  addLog, activeNav, onNavigate, children,
  adbServerRunning = false, onToggleAdb, isAdbConnecting = false,
  registeredDevices = [], onRegisterDevice, onUnregisterDevice, onToggleAutoConnect,
}) => {
  const { isDark } = useAppTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [connectModal, setConnectModal] = useState(false);
  const [viewportMedium, setViewportMedium] = useState(true);
  const [detectedToast, setDetectedToast] = useState<DeviceInfo | null>(null);
  const prevSerialsRef = useRef<string>('');
  const mainRef = useRef<HTMLElement>(null);

  const rescueSync = useRescueSync(devices, onRefresh);
  const { isTransmitting, toggleTransmit } = useStreamTracker({
    selectedSerial, devices, onNavigate, addLog,
  });

  useEffect(() => {
    const activeDevs = devices.filter((d) => d.state === 'device');
    const currentSerials = activeDevs.map((d) => d.serial).join(',');
    if (activeDevs.length > 0 && currentSerials !== prevSerialsRef.current) {
      const newlyAdded = activeDevs.find((d) => !prevSerialsRef.current.includes(d.serial)) || activeDevs[0];
      setDetectedToast(newlyAdded);
    }
    prevSerialsRef.current = currentSerials;
  }, [devices]);

  const handleConfirmTransmit = () => {
    if (!detectedToast) return;
    onSelectSerial(detectedToast.serial);
    setDetectedToast(null);
    onNavigate('projection');
    addLog(`Proyección activada para ${detectedToast.model}`, 'success');
  };

  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [activeNav]);
  useEffect(() => {
    const check = () => setViewportMedium(window.innerWidth >= BP_MED);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  useEffect(() => { if (!viewportMedium) setSidebarOpen(false); }, [viewportMedium]);

  return (
    <div suppressHydrationWarning className={`fixed inset-0 flex overflow-hidden ${isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'}`}>
      {viewportMedium ? (
        <Sidebar activeNav={activeNav} onSelectNav={onNavigate} collapsed={!sidebarOpen} onToggle={() => setSidebarOpen((p) => !p)} />
      ) : (
        sidebarOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <div className="relative z-10 h-full shadow-2xl">
              <Sidebar activeNav={activeNav} onSelectNav={(n) => { onNavigate(n); setSidebarOpen(false); }} />
            </div>
          </div>
        )
      )}

      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Header
          devices={devices}
          selectedSerial={selectedSerial}
          onSelectSerial={onSelectSerial}
          onScanRadar={onScanRadar}
          onOpenConnectModal={() => setConnectModal(true)}
          isScanning={isScanning}
          onRefresh={onRefresh}
          onToggleSidebar={() => setSidebarOpen((p) => !p)}
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
          isTransmitting={isTransmitting}
          onToggleTransmit={toggleTransmit}
        />

        {activeNav !== 'projection' && (
          <AutoDetectionToast
            device={detectedToast}
            onConfirm={handleConfirmTransmit}
            onClose={() => setDetectedToast(null)}
          />
        )}

        <main
          ref={mainRef}
          className={`relative flex-1 min-h-0 min-w-0 overflow-x-hidden ${
            activeNav === 'projection'
              ? 'overflow-hidden p-0 flex flex-col'
              : 'overflow-y-auto custom-scrollbar p-2 md:p-3'
          } ${isDark ? '' : 'bg-white'}`}
        >
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
