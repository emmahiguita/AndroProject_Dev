// ============================================================================
// ARCHIVO: ConfigView.tsx
// QUÉ HACE: Vista de Ajustes del Sistema y del Dispositivo Android conectado.
// CÓMO FUNCIONA: Al montar o cambiar `activeSerial`, consulta `GET /api/config`
//           para cargar las rutas reales de binarios (verificados en disco) y
//           los ajustes en vivo del móvil (`settings global/system`), permitiendo
//           modificarlos mediante `POST /api/config`.
// POR QUÉ: Corregir el bug donde `configData` aparecía vacío ("No configurado")
//           e inyectar control real sobre el dispositivo y el host (< 200L).
// ============================================================================
'use client';

import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  Settings, FolderOpen, HardDrive, Monitor, Zap, Camera,
  Wifi, Globe, Radio, Copy, Check, Wrench, RefreshCw, Terminal, ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { DeviceSettingsPanel, type LiveAndroidSettings } from './config/DeviceSettingsPanel';

interface ConfigViewProps {
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function ConfigView({ addLog: propAddLog }: ConfigViewProps = {}) {
  const { dark } = useTheme();
  const configData = useAppStore((s) => s.configData);
  const activeSerial = useAppStore((s) => s.activeSerial);
  const device = useAppStore((s) => s.device);
  const setActiveNav = useAppStore((s) => s.setActiveNav);
  const storeAddLog = useAppStore((s) => s.addLog);

  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [deviceSettings, setDeviceSettings] = useState<LiveAndroidSettings | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const log = useCallback(
    (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
      if (propAddLog) propAddLog(msg, type);
      else storeAddLog(msg);
    },
    [propAddLog, storeAddLog],
  );

  // Carga automática real de rutas de binarios y ajustes del dispositivo Android
  const loadConfig = useCallback(async () => {
    setBusyAction('load');
    try {
      const q = activeSerial ? `?serial=${encodeURIComponent(activeSerial)}` : '';
      const res = await fetch(`/api/config${q}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        useAppStore.setState({ configData: data });
        setVerified(data.verified || {});
        setDeviceSettings(data.deviceSettings || null);
      }
    } catch {
      log('Error al leer la configuración del sistema.', 'error');
    } finally {
      setBusyAction(null);
    }
  }, [activeSerial, log]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // Ejecuta un ajuste real en el dispositivo o en el servidor host
  const handleApplySetting = async (action: string, value?: string | number | boolean) => {
    setBusyAction(action);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, serial: activeSerial, value }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.deviceSettings) setDeviceSettings(data.deviceSettings);
        log(`Ajuste aplicado (${action})`, 'success');
      } else {
        log(data.error || 'Error aplicando ajuste', 'error');
      }
    } catch {
      log('Error de red al aplicar ajuste.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const cardCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-300 text-slate-900 shadow-sm';
  const btnCls = `px-2.5 py-1 rounded border text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
    dark ? 'bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800' : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
  }`;

  return (
    <ViewShell navId="config">
      <div className="mx-auto w-full max-w-4xl space-y-3">
        {/* Cabecera compacta con acciones reales de sistema */}
        <div className={`rounded-lg border p-3.5 flex flex-wrap items-center justify-between gap-2 ${cardCls}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded border flex items-center justify-center shrink-0 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
              <Settings size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold">Ajustes del Sistema y Dispositivo</h2>
              <p className={`text-[11px] ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>Control en vivo de parámetros Android (`settings`), rutas de binarios y red</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => handleApplySetting('open_captures')} disabled={busyAction !== null} className={btnCls}><FolderOpen size={12} /> <span>Abrir Capturas</span></button>
            <button type="button" onClick={() => handleApplySetting('restart_adb')} disabled={busyAction !== null} className={btnCls}><Zap size={12} /> <span>Reiniciar ADB</span></button>
            <button type="button" onClick={loadConfig} disabled={busyAction !== null} className={btnCls}><RefreshCw size={12} className={busyAction === 'load' ? 'animate-spin' : ''} /> <span>Recargar</span></button>
          </div>
        </div>

        <DeviceSettingsPanel dark={dark} serial={activeSerial || undefined} model={(device as { marketName?: string } | null)?.marketName || device?.model} settings={deviceSettings} busyAction={busyAction} onApplySetting={handleApplySetting} />

        {/* Cuadrícula de 2 columnas: Binarios verificados + Red y Accesos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className={`rounded-lg border p-3.5 space-y-2 ${cardCls}`}>
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><HardDrive size={13} /> Binarios y Rutas del Host</h3>
            <div className="space-y-1">
              <ConfigRow dark={dark} icon={<HardDrive size={12} />} label="Binario ADB" value={configData.adb || 'C:\\AndroProject\\adb.exe'} ok={verified.adb} />
              <ConfigRow dark={dark} icon={<Zap size={12} />} label="Binario Fastboot" value={configData.fastboot || 'fastboot.exe'} ok={verified.fastboot} />
              <ConfigRow dark={dark} icon={<Monitor size={12} />} label="Motor Scrcpy 4.1" value={configData.streamingEngine || 'scrcpy.exe'} ok={verified.scrcpy} />
              <ConfigRow dark={dark} icon={<Camera size={12} />} label="Carpeta de Capturas" value={configData.capturesDir || 'C:\\AndroProject\\Capturas'} ok />
              <ConfigRow dark={dark} icon={<FolderOpen size={12} />} label="Directorio Raíz" value={configData.home || 'C:\\AndroProject'} ok />
            </div>
          </div>

          <div className={`rounded-lg border p-3.5 flex flex-col justify-between gap-3 ${cardCls}`}>
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Wifi size={13} /> Red, Puertos y Servicios</h3>
              <div className="space-y-1">
                <ConfigRow dark={dark} icon={<Wifi size={12} />} label="Puerto ADB Wi-Fi" value={String(configData.wifiPort || 5555)} ok />
                <ConfigRow dark={dark} icon={<Globe size={12} />} label="Puerto Estudio Web (Next.js)" value="3000" ok />
                <ConfigRow dark={dark} icon={<Radio size={12} />} label="Receptor AirPlay 2 Nativo" value="7001 (Bonjour Activo)" ok />
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t border-zinc-800/40">
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>Módulos de Ingeniería</p>
              <div className="grid grid-cols-2 gap-1.5">
                <QuickNavBtn dark={dark} icon={<Monitor size={12} />} label="Proyección 60 FPS" onClick={() => setActiveNav('projection')} />
                <QuickNavBtn dark={dark} icon={<Terminal size={12} />} label="Inyección CLI & IA" onClick={() => setActiveNav('cli')} />
                <QuickNavBtn dark={dark} icon={<Wrench size={12} />} label="Herramientas ADB" onClick={() => setActiveNav('tools')} />
                <QuickNavBtn dark={dark} icon={<Zap size={12} />} label="Flasheador Fastboot" onClick={() => setActiveNav('flasher')} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ViewShell>
  );
}

/** Fila compacta de ruta o puerto con insignia de verificación y botón de copia. */
function ConfigRow({ icon, label, value, dark, ok }: { icon: ReactNode; label: string; value: string; dark: boolean; ok?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded border ${dark ? 'bg-zinc-900/50 border-zinc-800/80' : 'bg-slate-50 border-slate-200'}`}>
      <span className={`shrink-0 ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-semibold ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>{label}</span>
          {ok !== undefined && (
            <span className={`text-[10px] font-mono px-1.5 rounded border ${dark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-slate-100 border-slate-300 text-slate-800'}`}>{ok ? 'OK' : 'WARN'}</span>
          )}
        </div>
        <p className={`text-[11px] font-mono truncate ${dark ? 'text-zinc-400' : 'text-slate-600'}`} title={value}>{value}</p>
      </div>
      <button
        type="button"
        onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className={`p-1 rounded transition-colors ${dark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-slate-200 text-slate-700'}`}
        title="Copiar valor"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function QuickNavBtn({ dark, icon, label, onClick }: { dark: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded border text-[11px] font-semibold transition-colors ${
        dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
      }`}
    >
      <span className="flex items-center gap-1.5 truncate">{icon} <span className="truncate">{label}</span></span>
      <ChevronRight size={12} className="shrink-0 opacity-60" />
    </button>
  );
}
