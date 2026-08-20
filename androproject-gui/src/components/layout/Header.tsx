'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Smartphone, Radio, RefreshCw, Wifi, Sun, Moon,
  Menu, PanelRightOpen, PanelRightClose,
  Power, Plus, X, Link2, Unlink, ChevronDown,
} from 'lucide-react';
import { DeviceInfo } from '../../features/types';
import { useAppTheme } from '../ThemeProvider';
import type { RegisteredDevice } from '../../hooks/useAdbConnection';

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
  /** When true, projection page is active */
  projectionActive?: boolean;
  onNavigateProjection?: () => void;
  /** ADB connection state */
  adbServerRunning?: boolean;
  onToggleAdb?: () => void;
  isAdbConnecting?: boolean;
  registeredDevices?: RegisteredDevice[];
  onRegisterDevice?: (serial: string, model: string, connectionType: 'USB' | 'Wi-Fi', ip?: string, port?: string) => void;
  onUnregisterDevice?: (serial: string) => void;
  onToggleAutoConnect?: (serial: string) => void;
}

const btnBase = "flex items-center gap-1.5 text-[11px] font-semibold rounded-lg transition-all duration-150 active:scale-[0.97]";

export const Header: React.FC<HeaderProps> = ({
  devices, selectedSerial, onSelectSerial, onScanRadar, onOpenConnectModal,
  isScanning, onRefresh,
  onToggleSidebar, sidebarOpen, projectionActive, onNavigateProjection,
  adbServerRunning = false, onToggleAdb, isAdbConnecting = false,
  registeredDevices = [], onRegisterDevice, onUnregisterDevice, onToggleAutoConnect,
}) => {
  const { isDark, toggleTheme } = useAppTheme();
  const currentDevice = devices.find((d) => d.serial === selectedSerial) || devices[0];
  const [showDeviceManager, setShowDeviceManager] = useState(false);
  const deviceManagerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDeviceManager) return;
    const handler = (e: MouseEvent) => {
      if (deviceManagerRef.current && !deviceManagerRef.current.contains(e.target as Node)) {
        setShowDeviceManager(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDeviceManager]);

  return (
    <header className={`h-12 shrink-0 flex items-center gap-2 px-3 z-20 border-b ${
      isDark ? 'bg-[#0b0f1a]/95 border-white/5 backdrop-blur-md' : 'bg-white/95 border-slate-200 backdrop-blur-md'
    }`}>
      {/* Hamburger */}
      <button onClick={onToggleSidebar} title={sidebarOpen ? 'Contraer menú lateral' : 'Expandir menú lateral'}
        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-white/40 hover:text-white hover:bg-white/[0.06]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
        <Menu size={16} />
      </button>

      {/* Device selector */}
      <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 min-w-[180px] border ${
        isDark ? 'bg-white/[0.03] border-white/8' : 'bg-slate-50 border-slate-200'
      }`}>
        <Smartphone size={15} className={currentDevice?.state === 'device' ? 'text-[#22c97d]' : 'opacity-35'} />
        <select value={selectedSerial} onChange={(e) => onSelectSerial(e.target.value)} title="Seleccionar dispositivo Android"
          className={`bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer w-full ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {devices.length === 0 ? (
            <option value="">Sin dispositivos</option>
          ) : (
            devices.map((dev) => (
              <option key={dev.serial} value={dev.serial} className={isDark ? 'bg-[#0b0e17] text-white' : 'bg-white text-slate-900'}>
                {dev.model || dev.serial} ({dev.state})
              </option>
            ))
          )}
        </select>
      </div>

      {/* Status dot */}
      <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] border ${
        isDark ? 'bg-white/[0.02] border-white/5 text-white/50' : 'bg-slate-50 border-slate-200 text-slate-500'
      }`} title="Estado de la conexión ADB/Fastboot">
        <span className={`w-1.5 h-1.5 rounded-full ${
          currentDevice?.state === 'device' ? 'dot-connected' :
          currentDevice?.state === 'recovery' ? 'bg-amber-400' : 'bg-rose-500'
        }`} />
        {currentDevice?.state || 'offline'}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Projection button — navigates to projection page */}
      <button onClick={onNavigateProjection}
        className={`p-1.5 rounded-lg transition-colors ${projectionActive ? 'text-[#22c97d] bg-[#1bae6e]/10' : isDark ? 'text-white/35 hover:text-white/70' : 'text-slate-400 hover:text-slate-600'}`}
        title="Abrir proyección en vivo">
        <PanelRightOpen size={15} />
      </button>

      {/* Wi-Fi connect */}
      <button onClick={onOpenConnectModal} title="Conectar dispositivo vía IP Wi-Fi"
        className={`${btnBase} px-2.5 py-1.5 hidden sm:flex ${isDark ? 'bg-white/[0.04] hover:bg-white/[0.08] text-white/70 border-white/8' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'} border`}>
        <Wifi size={13} className="text-[#22c97d]" />
        <span>Wi-Fi</span>
      </button>

      {/* ADB Server Toggle + Device Manager */}
      <div className="relative flex items-center gap-0.5" ref={deviceManagerRef}>
        {/* ADB power toggle */}
        <button
          onClick={onToggleAdb}
          disabled={isAdbConnecting}
          title={adbServerRunning ? 'ADB activo — click para desactivar' : 'ADB inactivo — click para activar'}
          className={`${btnBase} px-2.5 py-1.5 rounded-r-none border-r-0 ${
            adbServerRunning
              ? (isDark ? 'bg-[#22c97d]/10 text-[#22c97d] border border-[#22c97d]/25' : 'bg-emerald-50 text-emerald-600 border border-emerald-200')
              : (isDark ? 'bg-white/[0.04] text-white/40 border border-white/8' : 'bg-slate-100 text-slate-400 border border-slate-200')
          } ${isAdbConnecting ? 'opacity-50 cursor-wait' : ''}`}
        >
          <Power size={13} className={isAdbConnecting ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">ADB</span>
        </button>

        {/* Device manager dropdown trigger */}
        <button
          onClick={() => setShowDeviceManager(!showDeviceManager)}
          title="Gestionar dispositivos registrados"
          className={`${btnBase} px-1.5 py-1.5 rounded-l-none ${
            showDeviceManager
              ? (isDark ? 'bg-white/10 text-white border border-white/8' : 'bg-slate-200 text-slate-700 border border-slate-200')
              : (isDark ? 'text-white/40 hover:text-white/70 hover:bg-white/[0.06] border border-white/8 border-l-0' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-slate-200 border-l-0')
          }`}
        >
          <ChevronDown size={11} className={`transition-transform duration-150 ${showDeviceManager ? 'rotate-180' : ''}`} />
        </button>

        {/* Device Manager Dropdown */}
        {showDeviceManager && (
          <div className={`absolute top-full right-0 mt-1 w-72 rounded-xl border shadow-xl z-50 ${
            isDark ? 'bg-[#0b0e17] border-white/10' : 'bg-white border-slate-200'
          }`}>
            <div className={`flex items-center justify-between px-3 py-2 border-b ${
              isDark ? 'border-white/5' : 'border-slate-100'
            }`}>
              <span className={`text-[11px] font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Dispositivos Registrados
              </span>
              <button onClick={() => setShowDeviceManager(false)}
                className={`p-1 rounded-lg ${isDark ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
                <X size={14} />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {registeredDevices.length === 0 ? (
                <div className={`px-3 py-4 text-center text-[10px] ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                  No hay dispositivos registrados
                </div>
              ) : (
                registeredDevices.map((dev) => {
                  const isOnline = devices.some(d => d.serial === dev.serial && d.state === 'device');
                  return (
                    <div key={dev.serial} className={`flex items-center gap-2 px-3 py-2 border-b ${
                      isDark ? 'border-white/5' : 'border-slate-50'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#22c97d]' : 'bg-white/20'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {dev.model}
                        </div>
                        <div className={`text-[8px] ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                          {dev.serial} · {dev.connectionType}
                        </div>
                      </div>
                      <button
                        onClick={() => onToggleAutoConnect?.(dev.serial)}
                        title={dev.autoConnect ? 'Desactivar auto-conexión' : 'Activar auto-conexión'}
                        className={`p-1 rounded-lg ${
                          dev.autoConnect
                            ? 'text-[#22c97d] bg-[#22c97d]/10'
                            : isDark ? 'text-white/30 hover:text-white/60' : 'text-slate-300 hover:text-slate-500'
                        }`}
                      >
                        <Link2 size={12} />
                      </button>
                      <button
                        onClick={() => onUnregisterDevice?.(dev.serial)}
                        title="Eliminar registro"
                        className="p-1 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/10"
                      >
                        <Unlink size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            {/* Add current device button */}
            {currentDevice && currentDevice.state === 'device' && !registeredDevices.some(d => d.serial === currentDevice.serial) && (
              <div className={`px-3 py-2 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                <button
                  onClick={() => {
                    const connType = currentDevice.connectionType === 'Wi-Fi' ? 'Wi-Fi' : 'USB';
                    const ip = currentDevice.serial.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1];
                    onRegisterDevice?.(currentDevice.serial, currentDevice.model || currentDevice.serial, connType, ip);
                    setShowDeviceManager(false);
                  }}
                  className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold ${
                    isDark
                      ? 'bg-[#22c97d]/10 text-[#22c97d] hover:bg-[#22c97d]/20 border border-[#22c97d]/20'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  <Plus size={12} />
                  Registrar dispositivo actual
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Radar */}
      <button onClick={onScanRadar} disabled={isScanning} title="Escanear red en busca de celulares Android"
        className={`${btnBase} px-2.5 py-1.5 bg-[#1bae6e]/10 hover:bg-[#1bae6e]/18 text-[#22c97d] border border-[#1bae6e]/25`}>
        <Radio size={13} className={isScanning ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">{isScanning ? 'Escanear' : 'Radar'}</span>
      </button>

      {/* Refresh */}
      <button onClick={onRefresh} title="Actualizar estado de dispositivos"
        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-white/35 hover:text-white hover:bg-white/[0.06]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
        <RefreshCw size={14} />
      </button>

      {/* Theme */}
      <button onClick={toggleTheme}
        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-amber-400/80 hover:text-amber-300 hover:bg-white/[0.06]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
        title={isDark ? 'Modo claro' : 'Modo oscuro'}>
        {isDark ? <Sun size={14} /> : <Moon size={14} />}
      </button>
    </header>
  );
};
