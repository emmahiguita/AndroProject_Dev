// ============================================================================
// ARCHIVO: TurboBoostPanel.tsx
// QUÉ HACE: Panel de aceleración Android que permite activar/desactivar el
//           Modo Desarrollador, abrir su menú en la pantalla del teléfono y
//           aplicar perfiles reales de velocidad, refresco y gráficos GPU.
// CÓMO FUNCIONA: Consulta `get_perf_status` al conectar dispositivo y dispara
//           `set_developer_mode`, `open_developer_settings` y `apply_perf_profile`.
// POR QUÉ: Exponer activación directa del Modo Desarrollador y perfiles Turbo
//           con diseño neutro de estudio (< 200 líneas, SRP).
// ============================================================================
'use client';
import { apiUrl } from '@/lib/api-url';

import React, { useState, useEffect, useCallback } from 'react';
import { Gauge, Flame, RotateCcw, Sparkles, Sliders, CheckCircle2, RefreshCw, ExternalLink, Power } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { DeviceInfo } from '../types';

type PerfProfileId = 'balanced' | 'fluid' | 'gaming' | 'restore';

export interface PerfStatus {
  developerMode: boolean; usbDebugging: boolean; wifiDebugging: boolean;
  stayAwake: boolean; showTouches: boolean; pointerLocation: boolean;
  dontKeepActivities: boolean; debugLayout: boolean; cachedFreezer: string;
  windowScale: string; transitionScale: string; animatorScale: string;
  disableBlur: boolean; gpuRenderer: string; disableOverlays: boolean;
  forceMsaa: boolean; peakRefresh: string; bgLimit: string;
}

interface TurboBoostPanelProps {
  device: DeviceInfo | null;
  addLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onOpenDevTab?: () => void;
}

const PROFILES: { id: PerfProfileId; title: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'balanced', title: 'Equilibrado', desc: 'Modo Desarrollador ON + animaciones 0.5x sin alterar GPU ni procesos.', icon: <Sliders size={14} /> },
  { id: 'fluid', title: 'Máxima Fluidez', desc: 'Desarrollador ON + animaciones 0.5x + sin blur + 120Hz + caché máx 4.', icon: <Gauge size={14} /> },
  { id: 'gaming', title: 'Turbo Gaming / GPU', desc: 'Desarrollador ON + animaciones 0x + Skia Vulkan + GPU directa + 120Hz + RAM.', icon: <Flame size={14} /> },
];

export const TurboBoostPanel: React.FC<TurboBoostPanelProps> = ({ device, addLog, onOpenDevTab }) => {
  const [status, setStatus] = useState<PerfStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeProfile, setActiveProfile] = useState<PerfProfileId | null>(null);
  const [appliedList, setAppliedList] = useState<string[]>([]);

  const serial = device?.serial;
  const isAndroid = Boolean(serial && !serial.startsWith('airplay-') && device?.platform !== 'ios');

  const fetchStatus = useCallback(async () => {
    if (!isAndroid || !serial) { setStatus(null); return; }
    try {
      const res = await fetch(apiUrl('/api/actions'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_perf_status', serial }),
      });
      const data = await res.json();
      if (data.success && data.status) setStatus(data.status);
      else setStatus(null);
    } catch { setStatus(null); }
  }, [isAndroid, serial]);

  useEffect(() => { void Promise.resolve().then(fetchStatus); }, [fetchStatus]);

  const handleToggleDevMode = async (openInPhone = false) => {
    if (!isAndroid || !device?.serial) return;
    setLoading(true);
    const nextState = openInPhone ? true : !status?.developerMode;
    try {
      const res = await fetch(apiUrl('/api/actions'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(openInPhone
          ? { action: 'open_developer_settings', serial: device.serial, screen: 'dev' }
          : { action: 'set_developer_mode', serial: device.serial, enabled: nextState }),
      });
      const data = await res.json();
      if (data.status) setStatus(data.status);
      addLog(data.success ? (data.message || 'Comando enviado') : (data.error || 'No se pudo completar la acción'), data.success ? 'success' : 'error');
    } catch { addLog('Error cambiando estado del Modo Desarrollador', 'error'); }
    finally { setLoading(false); }
  };

  const applyProfile = async (profile: PerfProfileId) => {
    if (!isAndroid || !device?.serial) { addLog('Conecta un dispositivo Android por ADB para aplicar perfiles Turbo.', 'error'); return; }
    setLoading(true);
    setActiveProfile(profile);
    addLog(`Aplicando perfil "${profile}" en ${device.serial}...`, 'info');
    try {
      const res = await fetch(apiUrl('/api/actions'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply_perf_profile', serial: device.serial, profile }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        addLog(`Error aplicando perfil: ${data.error || data.message || 'HTTP ' + res.status}`, 'error');
        return;
      }
      if (data.status) setStatus(data.status);
      setAppliedList(Array.isArray(data.applied) ? data.applied : []);
      addLog(data.message || `Perfil "${profile}" aplicado.`, 'success');
    } catch (err: unknown) {
      addLog(`Error de red en Turbo Boost: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally { setLoading(false); setActiveProfile(null); }
  };

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-xs font-bold flex items-center gap-1.5 text-text-primary">
            <Sparkles size={13} /> Turbo: Modo Desarrollador, Velocidad y Gráficos
          </h3>
          <p className="text-[11px] text-text-secondary">
            Activa el Modo Desarrollador, abre su panel en el móvil o aplica perfiles preconfigurados de GPU y fluidez.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant={status?.developerMode ? 'primary' : 'secondary'} icon={<Power size={12} />} onClick={() => handleToggleDevMode(false)} disabled={!isAndroid || loading}>
            {status?.developerMode ? 'Desarrollador: ON' : 'Activar Desarrollador'}
          </Button>
          <Button size="sm" variant="secondary" icon={<ExternalLink size={12} />} onClick={() => handleToggleDevMode(true)} disabled={!isAndroid || loading}>Abrir en Móvil</Button>
          {onOpenDevTab && (<Button size="sm" variant="secondary" icon={<Sliders size={12} />} onClick={onOpenDevTab}>Opciones Avanzadas</Button>)}
          <Button size="sm" variant="secondary" icon={<RefreshCw size={12} />} onClick={fetchStatus} disabled={!isAndroid || loading}>Leer</Button>
          <Button size="sm" variant="secondary" icon={<RotateCcw size={12} />} onClick={() => applyProfile('restore')} disabled={!isAndroid || loading}>Restaurar</Button>
        </div>
      </div>

      {status && (
        <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded border border-border bg-surface-raised text-text-primary">Desarrollador: <strong>{status.developerMode ? 'ACTIVO' : 'INACTIVO'}</strong></span>
          <span className="px-2 py-0.5 rounded border border-border bg-surface-raised text-text-primary">Animaciones: <strong>{status.windowScale}x / {status.transitionScale}x / {status.animatorScale}x</strong></span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {PROFILES.map((p) => (
          <button
            key={p.id} type="button" disabled={!isAndroid || loading} onClick={() => applyProfile(p.id)}
            className="text-left p-2.5 rounded-lg border border-border bg-surface-base hover:border-border-accent hover:bg-surface-raised transition-colors disabled:opacity-50 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-bold text-text-primary flex items-center gap-1.5">{p.icon} {p.title}</span>
              {loading && activeProfile === p.id && <RefreshCw size={12} className="animate-spin text-text-secondary" />}
            </div>
            <p className="text-[10px] text-text-secondary leading-snug">{p.desc}</p>
          </button>
        ))}
      </div>

      {appliedList.length > 0 && (
        <div className="p-2.5 rounded-lg border border-border bg-surface-base flex items-start gap-2 text-xs text-text-secondary">
          <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-text-primary" />
          <p className="leading-relaxed"><strong className="text-text-primary">Aplicado:</strong> {appliedList.join(' · ')}</p>
        </div>
      )}
    </Card>
  );
};
