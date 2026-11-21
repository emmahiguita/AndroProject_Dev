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
  onToggleRescue?: () => void;
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

  const btnNeutral = isDark
    ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-800'
    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300';
  const btnActive = isDark
    ? 'bg-zinc-100 hover:bg-white text-zinc-950 border-zinc-100'
    : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900';
  const iconBtn = `h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border transition-colors ${
    isDark
      ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800'
      : 'bg-white border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-100'
  }`;

  const statusLabel = !currentDevice
    ? 'Desconectado'
    : isIos
      ? 'AirPlay 60 FPS'
      : isConnected
        ? (currentDevice.connectionType === 'Wi-Fi' ? 'Wi-Fi Activo' : 'USB Activo')
        : currentDevice.state || 'Sin conexión';

  return (
    <header className={`h-14 w-full min-w-0 shrink-0 flex items-center gap-2 px-3 z-20 border-b ${
      isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'
    }`}>
      {/* Menú lateral */}
      <button type="button" onClick={onToggleSidebar} aria-label={sidebarOpen ? 'Contraer menú lateral' : 'Expandir menú lateral'} title={sidebarOpen ? 'Contraer menú' : 'Expandir menú'} className={iconBtn}>
        <Menu size={16} />
      </button>

      {/* Selector de dispositivo */}
      <div className={`h-9 flex items-center gap-2 rounded-lg px-2.5 min-w-[140px] flex-1 sm:flex-initial sm:w-48 md:w-56 max-w-[240px] border overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-300'}`}>
        <Smartphone size={15} className={`shrink-0 ${isConnected ? 'text-emerald-500' : (isDark ? 'text-zinc-400' : 'text-slate-500')}`} />
        <select value={selectedSerial} onChange={(e) => onSelectSerial(e.target.value)} aria-label="Seleccionar dispositivo Android / iOS" className={`h-full py-0 bg-transparent text-xs font-semibold leading-none focus:outline-none cursor-pointer w-full min-w-0 truncate ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
          {devices.length === 0 ? <option value="">Sin dispositivos</option> : devices.map((dev) => {
            const ios = dev.platform === 'ios' || dev.serial.startsWith('airplay-');
            return (
              <option key={dev.serial} value={dev.serial} className={isDark ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-slate-900'}>
                {ios ? (dev.model || 'iPhone (AirPlay)') : (dev.model || dev.serial)}
              </option>
            );
          })}
        </select>
      </div>

      {/* Botón Transmitiendo / Transmitir */}
      {isConnected && onToggleTransmit && (
        <button type="button" onClick={onToggleTransmit} title={isTransmitting ? 'Detener transmisión' : 'Iniciar transmisión en vivo'} className={`h-9 shrink-0 flex items-center gap-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${isTransmitting ? btnActive : btnNeutral}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${isTransmitting ? 'bg-emerald-500' : (isDark ? 'bg-zinc-500' : 'bg-slate-400')}`} />
          <span className="hidden md:inline">{isTransmitting ? 'Transmitiendo' : 'Transmitir'}</span>
        </button>
      )}

      {/* Tarjeta de estado al lado de Transmitiendo — misma altura h-9, icono 14px, texto legible */}
      <div className={`hidden lg:flex h-9 shrink-0 items-center gap-2 px-3 rounded-lg border text-xs font-medium ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-300 text-slate-800'}`} title={`Estado actual: ${statusLabel}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
        {currentDevice?.connectionType === 'Wi-Fi' ? <Wifi size={14} className="shrink-0 opacity-75" /> : <Usb size={14} className="shrink-0 opacity-75" />}
        <span className="whitespace-nowrap">{statusLabel}</span>
      </div>

      <div className="flex-1 min-w-0" />

      {/* Proyección */}
      <button type="button" onClick={onNavigateProjection} aria-label="Abrir proyección en vivo" title="Abrir proyección en vivo" className={projectionActive ? `h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border transition-colors ${btnActive}` : iconBtn}>
        <PanelRightOpen size={15} />
      </button>

      {/* Wi-Fi */}
      <button type="button" onClick={onOpenConnectModal} aria-label="Conectar dispositivo vía IP Wi-Fi" title="Conectar vía IP Wi-Fi" className={`h-9 px-2.5 hidden sm:flex items-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors ${btnNeutral}`}>
        <Wifi size={15} />
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

      {/* Rescate A30 */}
      {onToggleRescue && rescueConfig && (
        <button
          type="button"
          suppressHydrationWarning
          onClick={onToggleRescue}
          aria-label="Alternar Modo Rescate A30"
          title={rescueConfig.enabled ? `Modo Rescate ACTIVO · ${rescueMsg || 'Sincronización permanente'}` : 'Activar sincronización permanente A30'}
          className={`h-9 px-2.5 hidden sm:flex items-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors ${
            rescueConfig.enabled ? btnActive : btnNeutral
          }`}
        >
          <Zap size={15} />
          <span className="hidden xl:inline">Rescate A30</span>
        </button>
      )}

      {/* Radar */}
      <button type="button" onClick={onScanRadar} disabled={isScanning} aria-label="Escanear red" title="Escanear red local" className={`h-9 px-2.5 flex items-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors ${btnNeutral}`}>
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
    </header>
  );
};
