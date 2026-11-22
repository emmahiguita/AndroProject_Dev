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
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [connectModal, setConnectModal] = useState(false);
  const [viewportMedium, setViewportMedium] = useState(true);
  const [detectedToast, setDetectedToast] = useState<DeviceInfo | null>(null);
  const prevSerialsRef = useRef(new Set<string>());
  const mainRef = useRef<HTMLElement>(null);

  const rescueSync = useRescueSync(devices, onRefresh);
  const { isTransmitting, toggleTransmit } = useStreamTracker({
    selectedSerial, devices, onNavigate, addLog,
  });

  useEffect(() => {
    const activeDevs = devices.filter((d) => d.state === 'device');
    const currentSerials = new Set(activeDevs.map((d) => d.serial));
    const newlyAdded = activeDevs.find((d) => !prevSerialsRef.current.has(d.serial));
    setDetectedToast((visible) => newlyAdded ?? (visible && currentSerials.has(visible.serial) ? visible : null));
    prevSerialsRef.current = currentSerials;
  }, [devices]);

  const handleConfirmTransmit = () => {
    if (!detectedToast) return;
    onSelectSerial(detectedToast.serial);
    setDetectedToast(null);
    onNavigate('projection');
    addLog(`Vista de proyección abierta para ${detectedToast.model}`, 'info');
  };

  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [activeNav]);
  useEffect(() => {
    const check = () => setViewportMedium(window.innerWidth >= BP_MED);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  useEffect(() => {
    if (viewportMedium || !mobileSidebarOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [viewportMedium, mobileSidebarOpen]);

  const sidebarOpen = viewportMedium ? desktopSidebarOpen : mobileSidebarOpen;
  const toggleSidebar = viewportMedium ? setDesktopSidebarOpen : setMobileSidebarOpen;

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-surface-root text-text-primary">
      {viewportMedium ? (
        <Sidebar activeNav={activeNav} onSelectNav={onNavigate} collapsed={!desktopSidebarOpen} onToggle={() => setDesktopSidebarOpen((p) => !p)} />
      ) : (
        mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileSidebarOpen(false)} />
            <div className="relative z-10 h-full shadow-2xl">
              <Sidebar activeNav={activeNav} onSelectNav={(n) => { onNavigate(n); setMobileSidebarOpen(false); }} onToggle={() => setMobileSidebarOpen(false)} />
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
          onToggleSidebar={() => toggleSidebar((p) => !p)}
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
              : 'overflow-y-auto custom-scrollbar p-3 md:p-5'
          }`}
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
