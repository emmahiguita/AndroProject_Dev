// ============================================================================
// ARCHIVO: TurboBoostPanel.tsx
// QUÉ HACE: Panel de aceleración Android que activa Modo Desarrollador y aplica
//           perfiles reales de velocidad, refresco y gráficos GPU vía ADB.
// CÓMO FUNCIONA: Consulta `get_perf_status` al conectar dispositivo y dispara
//           `apply_perf_profile` (`balanced`, `fluid`, `gaming`, `restore`).
// POR QUÉ: Exponer controles reales de fluidez y gráficos en el Optimizador
//           con diseño neutro de estudio (sin bordes coloridos) y < 200 líneas.
// ============================================================================
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Gauge, Flame, RotateCcw, Sparkles, Sliders, CheckCircle2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { DeviceInfo } from '../types';

type PerfProfileId = 'balanced' | 'fluid' | 'gaming' | 'restore';

interface PerfStatus {
  developerMode: boolean;
  windowScale: string;
  transitionScale: string;
  animatorScale: string;
  disableBlur: boolean;
  gpuRenderer: string;
  disableOverlays: boolean;
  peakRefresh: string;
  bgLimit: string;
}

interface TurboBoostPanelProps {
  device: DeviceInfo | null;
  addLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const PROFILES: { id: PerfProfileId; title: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: 'balanced',
    title: 'Equilibrado',
    desc: 'Modo Desarrollador ON + animaciones 0.5x sin alterar GPU ni procesos.',
    icon: <Sliders size={14} />,
  },
  {
    id: 'fluid',
    title: 'Máxima Fluidez',
    desc: 'Desarrollador ON + animaciones 0.5x + sin blur + 120Hz + caché máx 4.',
    icon: <Gauge size={14} />,
  },
  {
    id: 'gaming',
    title: 'Turbo Gaming / GPU',
    desc: 'Desarrollador ON + animaciones 0x + Skia Vulkan + GPU directa + 120Hz + RAM.',
    icon: <Flame size={14} />,
  },
];

/** Bloque de perfiles de Modo Desarrollador, velocidad y gráficos GPU. */
export const TurboBoostPanel: React.FC<TurboBoostPanelProps> = ({ device, addLog }) => {
  const [status, setStatus] = useState<PerfStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeProfile, setActiveProfile] = useState<PerfProfileId | null>(null);
  const [appliedList, setAppliedList] = useState<string[]>([]);

  const isAndroid = Boolean(device?.serial && !device.serial.startsWith('airplay-') && device.platform !== 'ios');

  const fetchStatus = useCallback(async () => {
    if (!isAndroid || !device?.serial) {
      setStatus(null);
      return;
    }
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_perf_status', serial: device.serial }),
      });
      const data = await res.json();
      if (data.success && data.status) setStatus(data.status);
    } catch { /* Silencioso si se desconecta */ }
  }, [isAndroid, device?.serial]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const applyProfile = async (profile: PerfProfileId) => {
    if (!isAndroid || !device?.serial) {
      addLog('Conecta un dispositivo Android por ADB para aplicar perfiles Turbo.', 'error');
      return;
    }
    setLoading(true);
    setActiveProfile(profile);
    addLog(`Aplicando perfil "${profile}" (Modo Desarrollador + Gráficos) en ${device.serial}...`, 'info');
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } finally {
      setLoading(false);
      setActiveProfile(null);
    }
  };

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-xs font-bold flex items-center gap-1.5 text-text-primary">
            <Sparkles size={13} /> Turbo: Modo Desarrollador, Velocidad y Gráficos
          </h3>
          <p className="text-[10px] text-text-secondary">
            Activa Modo Desarrollador y configura animaciones, renderizado GPU, blur y tasa de refresco por ADB.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" icon={<RefreshCw size={12} />} onClick={fetchStatus} disabled={!isAndroid || loading}>
            Leer
          </Button>
          <Button size="sm" variant="secondary" icon={<RotateCcw size={12} />} onClick={() => applyProfile('restore')} disabled={!isAndroid || loading}>
            Restaurar
          </Button>
        </div>
      </div>

      {/* Estado real leído del dispositivo */}
      {status && (
        <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded border border-border bg-surface-raised text-text-primary">
            Desarrollador: <strong>{status.developerMode ? 'ON' : 'OFF'}</strong>
          </span>
          <span className="px-2 py-0.5 rounded border border-border bg-surface-raised text-text-primary">
            Animaciones: <strong>{status.windowScale}x</strong>
          </span>
          <span className="px-2 py-0.5 rounded border border-border bg-surface-raised text-text-primary">
            GPU: <strong>{status.gpuRenderer}</strong>
          </span>
          <span className="px-2 py-0.5 rounded border border-border bg-surface-raised text-text-primary">
            Blur: <strong>{status.disableBlur ? 'OFF' : 'ON'}</strong>
          </span>
          <span className="px-2 py-0.5 rounded border border-border bg-surface-raised text-text-primary">
            Refresco: <strong>{status.peakRefresh}</strong>
          </span>
          <span className="px-2 py-0.5 rounded border border-border bg-surface-raised text-text-primary">
            Fondo: <strong>{status.bgLimit}</strong>
          </span>
        </div>
      )}

      {/* Tarjetas de perfiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {PROFILES.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={!isAndroid || loading}
            onClick={() => applyProfile(p.id)}
            className="text-left p-2.5 rounded-lg border border-border bg-surface-base hover:border-border-accent hover:bg-surface-raised transition-colors disabled:opacity-50"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-bold text-text-primary flex items-center gap-1.5">
                {p.icon} {p.title}
              </span>
              {loading && activeProfile === p.id && <RefreshCw size={12} className="animate-spin text-text-secondary" />}
            </div>
            <p className="text-[10px] text-text-secondary leading-snug">{p.desc}</p>
          </button>
        ))}
      </div>

      {/* Confirmación de ajustes reales aplicados */}
      {appliedList.length > 0 && (
        <div className="p-2.5 rounded-lg border border-border bg-surface-base flex items-start gap-2 text-xs text-text-secondary">
          <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-text-primary" />
          <p className="leading-relaxed">
            <strong className="text-text-primary">Aplicado:</strong> {appliedList.join(' · ')}
          </p>
        </div>
      )}
    </Card>
  );
};
