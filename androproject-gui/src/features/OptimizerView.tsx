// ============================================================================
// ARCHIVO: OptimizerView.tsx
// QUÉ HACE: Orquestador completo del Optimizador de Sistema Android:
//           1) Aceleración de RAM, limpieza TRIM y Perfiles Turbo (`performance`)
//           2) Activación y Uso de todas las Opciones del Modo Desarrollador (`diagnostics`)
//           3) Red, DNS Privado/AdGuard y Túnel DNS (`network`)
//           4) Audio Bluetooth A2DP y Panel de Notificaciones (`audio`)
// CÓMO FUNCIONA: Carga `get_optimizer_settings` desde `/api/actions`, sincroniza
//           `optimizerSlice` en `useAppStore` y alterna los subpaneles modulares.
// POR QUÉ: Inyectar lógica completa sin acciones ni estados huérfanos (< 200L).
// ============================================================================
'use client';
import { apiUrl } from '@/lib/api-url';

import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Cpu, HardDrive, RefreshCw, CheckCircle2, Sparkles, Sliders, Globe, Volume2, Trash2 } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '../components/ViewShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TurboBoostPanel } from './optimizer/TurboBoostPanel';
import { DeveloperOptionsPanel } from './optimizer/DeveloperOptionsPanel';
import { OptimizerNetworkAudioPanel } from './optimizer/OptimizerNetworkAudioPanel';
import type { OptimizerTab } from '@/stores/optimizerSlice';
import type { DeviceInfo } from './types';

interface OptimizerViewProps {
  device: DeviceInfo | null;
  addLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const OptimizerView: React.FC<OptimizerViewProps> = ({ device: propDevice, addLog }) => {
  const { dark } = useTheme();
  const s = useAppStore();
  const device = propDevice || s.device;
  const targetSerial = s.activeSerial || device?.serial || null;
  const isAndroid = Boolean(targetSerial && !targetSerial.startsWith('airplay-') && !targetSerial.startsWith('apple-') && device?.platform !== 'ios');

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [optimizationComplete, setOptimizationComplete] = useState(false);
  const [freedMemoryMB, setFreedMemoryMB] = useState<number | null>(null);

  const loadOptimizerSettings = useCallback(async () => {
    if (!isAndroid || !targetSerial) return;
    try {
      const res = await fetch(apiUrl('/api/actions'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_optimizer_settings', serial: targetSerial }),
      });
      const data = await res.json();
      const st = data.settings;
      if (!data.success || !st) return;
      if (st.animScales) s.setAnimScales(st.animScales);
      if (typeof st.dpi === 'number') s.setCurrentDpi(st.dpi);
      if (st.gpuTweaks) s.setGpuTweaks(st.gpuTweaks);
      if (st.backgroundLimit) s.setBackgroundLimit(st.backgroundLimit);
      if (st.screenTimeout) s.setScreenTimeout(st.screenTimeout);
      if (st.peakRefreshRate) s.setPeakRefreshRate(st.peakRefreshRate);
      if (st.nightMode) s.setNightMode(st.nightMode);
      if (typeof st.autoBrightness === 'boolean') s.setAutoBrightness(st.autoBrightness);
      if (typeof st.stayAwake === 'boolean') s.setStayAwake(st.stayAwake);
      if (typeof st.demoMode === 'boolean') s.setDemoMode(st.demoMode);
      if (typeof st.showTouches === 'boolean') s.setShowTouches(st.showTouches);
      if (typeof st.wifiScanInterval === 'number') s.setWifiScanInterval(st.wifiScanInterval);
      if (typeof st.wifiPowerSave === 'boolean') s.setWifiPowerSave(st.wifiPowerSave);
      if (st.privateDnsMode) s.setPrivateDnsMode(st.privateDnsMode);
      if (typeof st.privateDnsSpecifier === 'string') s.setPrivateDnsSpecifier(st.privateDnsSpecifier);
      if (st.adguardProfile) s.setAdguardProfile(st.adguardProfile);
      if (st.bluetooth) {
        s.setBluetoothInfo({
          codec: String(st.bluetooth.codec || ''),
          sampleRate: String(st.bluetooth.sampleRate || ''),
          bitsPerSample: String(st.bluetooth.bitsPerSample || ''),
          ldacQuality: String(st.bluetooth.ldacQuality || ''),
          disableAbsoluteVolume: st.bluetooth.disableAbsoluteVolume ? 'true' : 'false',
        });
      }
      if (st.shade) {
        s.setShadeHighContrast(Boolean(st.shade.highContrast));
        s.setShadeBoldText(st.shade.fontScale === '1.1');
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAndroid, targetSerial]);

  useEffect(() => { loadOptimizerSettings(); }, [loadOptimizerSettings]);

  const handleRunOptimization = async () => {
    if (!targetSerial) { addLog('No hay ningún dispositivo seleccionado para optimizar.', 'error'); return; }
    setIsOptimizing(true);
    setOptimizationComplete(false);
    addLog(`Iniciando aceleración de RAM y procesos en ${targetSerial}...`, 'info');
    try {
      const res = await fetch(apiUrl('/api/actions'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'optimize_ram', serial: targetSerial }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { addLog(`Error al optimizar: ${data.error || 'HTTP ' + res.status}`, 'error'); return; }
      const freed = typeof data.freedMB === 'number' ? data.freedMB : null;
      setFreedMemoryMB(freed);
      setOptimizationComplete(true);
      addLog(freed !== null ? `Optimización completada. Se liberaron ${freed} MB de RAM.` : (data.message || 'Solicitud enviada a Android.'), 'success');
    } catch (err: unknown) {
      addLog(`Error de red al optimizar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally { setIsOptimizing(false); }
  };

  const handleRunTrim = async () => {
    if (!targetSerial) return;
    setIsTrimming(true);
    addLog(`Ejecutando TRIM de almacenamiento y caché en ${targetSerial}...`, 'info');
    try {
      const res = await fetch(apiUrl('/api/actions'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_trim', serial: targetSerial }),
      });
      const data = await res.json();
      addLog(data.message || data.error || 'TRIM finalizado', data.success ? 'success' : 'error');
    } catch { addLog('Error de red ejecutando TRIM', 'error'); }
    finally { setIsTrimming(false); }
  };

  const tabs: { id: OptimizerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'performance', label: 'Acelerador & Perfiles Turbo', icon: <Zap size={13} /> },
    { id: 'diagnostics', label: 'Modo Desarrollador & Opciones', icon: <Sliders size={13} /> },
    { id: 'network', label: 'Red, DNS & Túnel', icon: <Globe size={13} /> },
    { id: 'audio', label: 'Audio BT & Interfaz', icon: <Volume2 size={13} /> },
  ];

  return (
    <ViewShell navId="optimizer">
      <div className="max-w-4xl mx-auto space-y-2.5">
        <div className={`custom-scrollbar flex gap-3 overflow-x-auto border-b ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => s.setOptimizerTab(t.id)}
              className={`pb-2 px-2.5 font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                s.optimizerTab === t.id
                  ? dark ? 'border-zinc-100 text-zinc-100' : 'border-slate-900 text-slate-900'
                  : `border-transparent ${dark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'}`
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {s.optimizerTab === 'performance' && (
          <>
            <Card padding="md">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold">Acelerador de Sistema, Memoria RAM y TRIM de Caché</h2>
                  <p className="text-xs text-text-secondary max-w-lg">Cierra procesos en segundo plano (`am kill-all`), compacta memoria y purga cachés de paquetes (`trim-caches`).</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="secondary" icon={<Trash2 size={13} />} onClick={handleRunTrim} disabled={isTrimming || !isAndroid}>{isTrimming ? 'Limpiando...' : 'Limpiar Caché (TRIM)'}</Button>
                  <Button size="sm" icon={<Zap size={14} className={isOptimizing ? 'animate-bounce' : ''} />} onClick={handleRunOptimization} disabled={isOptimizing || !isAndroid}>{isOptimizing ? 'Optimizando...' : 'Acelerar RAM'}</Button>
                </div>
              </div>
            </Card>

            {optimizationComplete && (
              <Card padding="sm">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-text-primary shrink-0" />
                  <p className="text-xs text-text-secondary">
                    <strong className="text-text-primary">Solicitud enviada.</strong> {freedMemoryMB !== null ? <>Liberados <strong className="text-text-primary font-mono">{freedMemoryMB} MB</strong> de RAM.</> : 'Android recibió la solicitud de detener procesos en segundo plano.'}
                  </p>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Card padding="sm"><div className="flex items-center justify-between text-text-secondary"><span className="text-[11px] font-semibold uppercase tracking-wider">Memoria RAM</span><Cpu size={14} /></div><p className="text-base font-bold font-mono text-text-primary mt-1">{device?.ram || '--'}</p><p className="text-xs text-text-secondary">{device?.ramUsagePercent != null ? `${device.ramUsagePercent}% en uso` : 'RAM total'}</p></Card>
              <Card padding="sm"><div className="flex items-center justify-between text-text-secondary"><span className="text-[11px] font-semibold uppercase tracking-wider">Almacenamiento</span><HardDrive size={14} /></div><p className="text-base font-bold font-mono text-text-primary mt-1">{device?.storage || '--'}</p><p className="text-xs text-text-secondary">{device?.storageFreeGB != null ? `${device.storageFreeGB} GB libres` : 'Capacidad total'}</p></Card>
              <Card padding="sm"><div className="flex items-center justify-between text-text-secondary"><span className="text-[11px] font-semibold uppercase tracking-wider">CPU</span><RefreshCw size={14} /></div><p className="text-base font-bold font-mono text-text-primary mt-1">{device?.cpuUsagePercent != null ? `${device.cpuUsagePercent}%` : '--'}</p><p className="text-xs text-text-secondary">Uso de procesador</p></Card>
            </div>

            <TurboBoostPanel device={device} addLog={addLog} onOpenDevTab={() => s.setOptimizerTab('diagnostics')} />
          </>
        )}

        {s.optimizerTab === 'diagnostics' && <DeveloperOptionsPanel serial={targetSerial} addLog={addLog} onRefreshGlobalSettings={loadOptimizerSettings} />}
        {(s.optimizerTab === 'network' || s.optimizerTab === 'audio' || s.optimizerTab === 'notifications') && (
          <OptimizerNetworkAudioPanel serial={targetSerial} mode={s.optimizerTab === 'network' ? 'network' : 'audio'} addLog={addLog} />
        )}
        <p className="text-[11px] text-text-secondary flex items-center gap-1"><Sparkles size={11} /> Lectura y aplicación directa en el kernel y `settings` de Android mediante ADB.</p>
      </div>
    </ViewShell>
  );
};
