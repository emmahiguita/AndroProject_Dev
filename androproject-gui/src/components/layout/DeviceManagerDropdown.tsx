// ============================================================================
// ARCHIVO: DeviceManagerDropdown.tsx
// QUÉ HACE: Menú desplegable de dispositivos registrados y estado del servidor
//           ADB en la barra superior de AndroProject Studio.
// CÓMO FUNCIONA: Permite encender/apagar ADB, registrar el dispositivo actual,
//           activar auto-conexión o eliminar registros persistidos.
// POR QUÉ: Desacoplar el popover de `Header.tsx` bajo SRP (< 200 líneas) con
//           alturas uniformes (`h-9`), iconos `15px` y texto legible claro/oscuro.
// ============================================================================

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Power, ChevronDown, X, Link2, Unlink, Plus } from 'lucide-react';
import type { DeviceInfo } from '../../features/types';
import type { RegisteredDevice } from '../../hooks/useAdbConnection';

interface DeviceManagerDropdownProps {
  isDark: boolean;
  devices: DeviceInfo[];
  currentDevice?: DeviceInfo;
  adbServerRunning: boolean;
  isAdbConnecting: boolean;
  onToggleAdb?: () => void;
  registeredDevices: RegisteredDevice[];
  onRegisterDevice?: (serial: string, model: string, connectionType: 'USB' | 'Wi-Fi', ip?: string, port?: string) => void;
  onUnregisterDevice?: (serial: string) => void;
  onToggleAutoConnect?: (serial: string) => void;
}

export function DeviceManagerDropdown({
  isDark, devices, currentDevice,
  adbServerRunning, isAdbConnecting, onToggleAdb,
  registeredDevices, onRegisterDevice, onUnregisterDevice, onToggleAutoConnect,
}: DeviceManagerDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !containerRef.current?.contains(document.activeElement)) return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const activeCls = 'border-border-selected bg-surface-selected text-text-selected hover:bg-surface-overlay';
  const idleCls = 'border-border-control bg-surface-card text-text-primary hover:bg-surface-overlay';

  return (
    <div className="relative flex items-center shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={onToggleAdb}
        disabled={isAdbConnecting}
        aria-pressed={adbServerRunning}
        aria-busy={isAdbConnecting}
        aria-label={adbServerRunning ? 'ADB activo — click para desactivar' : 'ADB inactivo — click para activar'}
        title={adbServerRunning ? 'ADB activo — click para desactivar' : 'ADB inactivo — click para activar'}
        className={`h-9 px-2.5 flex items-center gap-1.5 text-xs font-semibold rounded-l-lg border border-r-0 transition-colors ${
          adbServerRunning ? activeCls : idleCls
        } ${isAdbConnecting ? 'opacity-50 cursor-wait' : ''}`}
      >
        <Power size={15} className={isAdbConnecting ? 'animate-spin' : ''} />
        <span className="hidden lg:inline">ADB</span>
      </button>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="registered-devices"
        aria-label="Gestionar dispositivos registrados"
        title="Gestionar dispositivos registrados"
        className={`h-9 px-2 flex items-center justify-center rounded-r-lg border transition-colors ${
          open ? activeCls : idleCls
        }`}
      >
        <ChevronDown size={14} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div id="registered-devices" className="absolute left-[-4.25rem] top-full z-50 mt-1.5 w-72 max-w-[calc(100vw-1.5rem)] rounded-lg border border-border-control bg-surface-card text-text-primary shadow-xl sm:left-auto sm:right-0">
          <div className={`flex items-center justify-between px-3 py-2.5 border-b ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}>
            <span className="text-xs font-semibold">Dispositivos Registrados</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className={`p-1 rounded-md ${isDark ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
              <X size={14} />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {registeredDevices.length === 0 ? (
              <div className={`px-3 py-5 text-center text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                No hay dispositivos registrados
              </div>
            ) : (
              registeredDevices.map((dev) => {
                const isOnline = devices.some((d) => d.serial === dev.serial && d.state === 'device');
                return (
                  <div key={dev.serial} className={`flex items-center gap-2.5 px-3 py-2 border-b ${isDark ? 'border-zinc-800/70' : 'border-slate-100'}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{dev.model}</p>
                      <p className={`text-[10px] font-mono truncate ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                        {dev.serial} · {dev.connectionType}
                      </p>
                    </div>
                    <button type="button" onClick={() => onToggleAutoConnect?.(dev.serial)} title={dev.autoConnect ? 'Desactivar auto-conexión' : 'Activar auto-conexión'} className={`p-1.5 rounded-md ${dev.autoConnect ? activeCls : idleCls}`}>
                      <Link2 size={13} />
                    </button>
                    <button type="button" onClick={() => onUnregisterDevice?.(dev.serial)} title="Eliminar registro" className="p-1.5 rounded-md text-red-500 hover:bg-red-500/10">
                      <Unlink size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {currentDevice && currentDevice.state === 'device' && !registeredDevices.some((d) => d.serial === currentDevice.serial) && (
            <div className={`p-2.5 border-t ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => {
                  const connType = currentDevice.connectionType === 'Wi-Fi' ? 'Wi-Fi' : 'USB';
                  const ip = currentDevice.serial.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1];
                  onRegisterDevice?.(currentDevice.serial, currentDevice.model || currentDevice.serial, connType, ip);
                  setOpen(false);
                }}
                className={`w-full h-8 flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold border transition-colors ${idleCls}`}
              >
                <Plus size={14} /> Registrar dispositivo actual
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
