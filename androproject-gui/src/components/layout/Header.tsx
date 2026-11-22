// ============================================================================
// ARCHIVO: Header.tsx
// QUÉ HACE: Barra superior de navegación y control rápido de dispositivos
//           (selector, transmisión, estado de conexión, Wi-Fi, ADB, Radar y tema).
// CÓMO FUNCIONA: Estandariza todos los controles a altura `h-9`, iconos `15px`
//           y tipografía `text-xs` legible en modo claro y oscuro.
// POR QUÉ: Eliminar tarjetas desalineadas, textos diminutos y colores neón al
//           lado del botón "Transmitiendo", cumpliendo SRP (< 200 líneas).
// ============================================================================

'use client';

import React from 'react';
import {
  Smartphone, Radio, RefreshCw, Wifi, Sun, Moon,
  Menu, PanelRightOpen, Zap, Usb,
} from 'lucide-react';
import { DeviceInfo } from '../../features/types';
import { useAppTheme } from '../ThemeProvider';
import { DeviceManagerDropdown } from './DeviceManagerDropdown';
import type { RegisteredDevice } from '../../hooks/useAdbConnection';
import type { RescueSyncConfig, RescueSyncStatus } from '../../hooks/useRescueSync';

interface HeaderProps {
  devices: DeviceInfo[];
  selectedSerial: string;
  onSelectSerial: (serial: string) => void;
  onScanRadar: () => void;
  onOpenConnectModal: () => void;
  isScanning: boolean;
  onRefresh: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  projectionActive?: boolean;
  onNavigateProjection?: () => void;
  adbServerRunning?: boolean;
  onToggleAdb?: () => void;
  isAdbConnecting?: boolean;
  registeredDevices?: RegisteredDevice[];
  onRegisterDevice?: (serial: string, model: string, connectionType: 'USB' | 'Wi-Fi', ip?: string, port?: string) => void;
  onUnregisterDevice?: (serial: string) => void;
  onToggleAutoConnect?: (serial: string) => void;
  rescueConfig?: RescueSyncConfig;
  rescueStatus?: RescueSyncStatus;
  rescueMsg?: string;
  onToggleRescue?: (device?: DeviceInfo) => void;
  isTransmitting?: boolean;
  onToggleTransmit?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  devices, selectedSerial, onSelectSerial, onScanRadar, onOpenConnectModal,
  isScanning, onRefresh, onToggleSidebar, sidebarOpen, projectionActive, onNavigateProjection,
  adbServerRunning = false, onToggleAdb, isAdbConnecting = false,
  registeredDevices = [], onRegisterDevice, onUnregisterDevice, onToggleAutoConnect,
  rescueConfig, rescueMsg, onToggleRescue,
  isTransmitting = false, onToggleTransmit,
}) => {
  const { isDark, toggleTheme } = useAppTheme();
  const currentDevice = devices.find((d) => d.serial === selectedSerial) || devices[0];
  const isConnected = currentDevice?.state === 'device';
  const isIos = currentDevice?.platform === 'ios' || currentDevice?.serial.startsWith('airplay-');

  const btnNeutral = 'border-border-control bg-surface-card text-text-primary hover:bg-surface-overlay';
  const btnActive = 'border-border-selected bg-surface-selected text-text-selected hover:bg-surface-overlay';
  const iconBtn = `grid size-9 shrink-0 place-items-center rounded-md border transition-colors ${btnNeutral}`;

  const statusLabel = !currentDevice
    ? 'Desconectado'
    : isConnected
      ? isIos ? 'AirPlay activo' : currentDevice.connectionType === 'Wi-Fi' ? 'Wi-Fi activo' : 'USB activo'
      : currentDevice.state === 'unauthorized' ? 'Sin autorizar' : 'Sin conexión';

  return (
    <header className="relative z-20 flex w-full min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-chrome px-3 py-2.5">
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
      {/* Menú lateral */}
      <button type="button" onClick={onToggleSidebar} aria-controls="studio-sidebar" aria-expanded={sidebarOpen} aria-label={sidebarOpen ? 'Contraer menú lateral' : 'Expandir menú lateral'} title={sidebarOpen ? 'Contraer menú' : 'Expandir menú'} className={iconBtn}>
        <Menu size={16} />
      </button>

      {/* Selector de dispositivo */}
      <div className="flex h-9 w-44 max-w-full items-center gap-2 rounded-md border border-border-control bg-surface-card px-2.5 text-text-primary sm:w-48">
        <Smartphone size={16} className={`shrink-0 ${isConnected ? 'text-semantic-success' : 'text-text-tertiary'}`} />
        <select value={currentDevice?.serial ?? ''} disabled={devices.length === 0} onChange={(e) => onSelectSerial(e.target.value)} aria-label="Seleccionar dispositivo Android / iOS" className="h-7 w-full min-w-0 truncate bg-transparent text-xs font-semibold">
          {devices.length === 0 ? <option value="">Sin dispositivos</option> : devices.map((dev) => {
            const ios = dev.platform === 'ios' || dev.serial.startsWith('airplay-');
            return (
              <option key={dev.serial} value={dev.serial} className="bg-surface-card text-text-primary">
                {ios ? (dev.model || 'iPhone (AirPlay)') : (dev.model || dev.serial)}
              </option>
            );
          })}
        </select>
      </div>

      {/* Botón Transmitiendo / Transmitir */}
      {isConnected && onToggleTransmit && (
        <button type="button" onClick={onToggleTransmit} aria-label={isTransmitting ? 'Detener transmisión' : 'Iniciar transmisión en vivo'} title={isTransmitting ? 'Detener transmisión' : 'Iniciar transmisión en vivo'} className={`flex h-9 shrink-0 items-center gap-2 rounded-md border px-2.5 text-xs font-semibold transition-colors ${isTransmitting ? btnActive : btnNeutral}`}>
          <span className={`size-2 shrink-0 rounded-full ${isTransmitting ? 'bg-semantic-success' : 'bg-text-tertiary'}`} />
          <span>{isTransmitting ? 'Transmitiendo' : 'Transmitir'}</span>
        </button>
      )}

      {/* Tarjeta de estado al lado de Transmitiendo — misma altura h-9, icono 14px, texto legible */}
      <div className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-surface-base px-2.5 text-xs font-medium text-text-secondary" title={`Estado actual: ${statusLabel}`}>
        {currentDevice?.connectionType === 'Wi-Fi' ? <Wifi size={15} className={isConnected ? 'text-semantic-success' : undefined} /> : <Usb size={15} className={isConnected ? 'text-semantic-success' : undefined} />}
        <span className="whitespace-nowrap">{statusLabel}</span>
      </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">

      {/* Proyección */}
      <button type="button" onClick={onNavigateProjection} aria-label="Abrir proyección en vivo" title="Abrir proyección en vivo" className={projectionActive ? `grid size-9 shrink-0 place-items-center rounded-md border transition-colors ${btnActive}` : iconBtn}>
        <PanelRightOpen size={15} />
      </button>

      {/* Wi-Fi */}
      <button type="button" onClick={onOpenConnectModal} aria-label="Conectar dispositivo vía IP Wi-Fi" title="Conectar vía IP Wi-Fi" className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors ${btnNeutral}`}>
        <Wifi size={15} className="shrink-0" />
        <span className="hidden lg:inline">Wi-Fi</span>
      </button>

      {/* ADB + Dispositivos registrados */}
      <DeviceManagerDropdown
        isDark={isDark}
        devices={devices}
        currentDevice={currentDevice}
        adbServerRunning={adbServerRunning}
        isAdbConnecting={isAdbConnecting}
        onToggleAdb={onToggleAdb}
        registeredDevices={registeredDevices}
        onRegisterDevice={onRegisterDevice}
        onUnregisterDevice={onUnregisterDevice}
        onToggleAutoConnect={onToggleAutoConnect}
      />

      {/* Rescate Permanente Universal (cualquier móvil con táctil dañado) */}
      {onToggleRescue && rescueConfig && (
        <button
          type="button"
          suppressHydrationWarning
          onClick={() => onToggleRescue(currentDevice)}
          aria-label="Alternar Rescate Permanente para el móvil actual"
          aria-pressed={rescueConfig.enabled}
          title={
            rescueConfig.enabled
              ? `Rescate ACTIVO (${rescueConfig.targetModel || 'Auto'}) · ${rescueMsg || 'Sincronización permanente'} — Click para desactivar`
              : `Activar Rescate Permanente en PC${currentDevice?.model ? ` para ${currentDevice.model}` : ''}`
          }
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
            rescueConfig.enabled ? btnActive : btnNeutral
          }`}
        >
          <Zap size={15} className={`shrink-0 ${rescueConfig.enabled ? 'text-semantic-success' : ''}`} />
          <span className="hidden xl:inline">{rescueConfig.enabled ? 'Rescate ON' : 'Rescate'}</span>
        </button>
      )}

      {/* Radar */}
      <button type="button" onClick={onScanRadar} disabled={isScanning} aria-busy={isScanning} aria-label="Escanear red" title="Escanear red local" className={`flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors disabled:opacity-65 ${btnNeutral}`}>
        <Radio size={15} className={isScanning ? 'animate-spin' : ''} />
        <span className="hidden lg:inline">{isScanning ? 'Escaneando' : 'Radar'}</span>
      </button>

      {/* Refrescar */}
      <button type="button" onClick={onRefresh} aria-label="Actualizar dispositivos" title="Actualizar dispositivos" className={iconBtn}>
        <RefreshCw size={15} />
      </button>

      {/* Tema Claro / Oscuro */}
      <button type="button" onClick={toggleTheme} aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} className={iconBtn}>
        {isDark ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      </div>
    </header>
  );
};
