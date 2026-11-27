// ============================================================================
// ARCHIVO: optimizer/GpuDriverPanel.tsx
// QUÉ HACE: Panel de inspección, prueba y optimización de drivers gráficos
//           Android (ARM Mali, Adreno, Vulkan HWUI, ANGLE, Updatable Driver y
//           benchmark real `dumpsys gfxinfo`).
// CÓMO FUNCIONA: Consulta `GET /api/gpu-driver` y dispara `POST /api/gpu-driver`
//           para alternar entre Skia Vulkan / SkiaGL / ANGLE, elegir perfil de
//           driver actualizable y medir frames/jank reales en el dispositivo.
// POR QUÉ: Permitir probar y mejorar el rendimiento GPU/Vulkan/Mali de forma
//          segura, verificable y reversible sin root (< 165 líneas, SRP).
// ============================================================================
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Cpu, Gauge, RefreshCw, Flame, Loader2 } from 'lucide-react';
import { apiUrl } from '@/lib/api-url';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks/useTheme';

interface GpuInfo {
  gpuFamily: string;
  glesInfo: string;
  socPlatform: string;
  vulkanHal: string;
  vulkanSupported: boolean;
  vulkanFeatures: string[];
  hwuiRenderer: string;
  updatableDriverMode: string;
  driverPackages: string[];
}

interface GpuDriverPanelProps {
  serial: string | null;
  addLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const GpuDriverPanel: React.FC<GpuDriverPanelProps> = ({ serial, addLog }) => {
  const { dark } = useTheme();
  const [info, setInfo] = useState<GpuInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bench, setBench] = useState<string[]>([]);

  const loadGpu = useCallback(async () => {
    if (!serial) return;
    try {
      const r = await fetch(apiUrl(`/api/gpu-driver?serial=${encodeURIComponent(serial)}`));
      const d = await r.json();
      if (d.success) setInfo(d);
    } catch {}
  }, [serial]);

  useEffect(() => { void loadGpu(); }, [loadGpu]);

  const runGpuAction = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!serial) return;
    setBusy(action);
    try {
      const r = await fetch(apiUrl('/api/gpu-driver'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, serial, ...payload }),
      });
      const d = await r.json();
      if (Array.isArray(d.metrics)) setBench(d.metrics);
      addLog(d.message || d.error || action, d.success ? 'success' : 'error');
      await loadGpu();
    } catch { addLog(`Error ejecutando ${action}`, 'error'); }
    finally { setBusy(null); }
  };

  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';
  const boxCls = dark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-200';
  const chipCls = (active: boolean) =>
    `px-2.5 py-1 rounded border text-[11px] font-mono font-semibold transition-colors cursor-pointer disabled:opacity-55 ${
      active ? (dark ? 'bg-zinc-100 text-zinc-950 border-zinc-100' : 'bg-slate-900 text-white border-slate-900')
             : (dark ? 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100')
    }`;

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Cpu size={14} /> Laboratorio de Drivers GPU · Vulkan / Mali / Adreno / ANGLE
          </h4>
          <p className={`text-[11px] ${mutedCls}`}>
            Inspecciona el driver gráfico real del móvil, prueba Skia Vulkan / ANGLE / Game Driver y mide frames reales (`gfxinfo`).
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="primary" icon={busy === 'benchmark_gpu' ? <Loader2 size={12} className="animate-spin" /> : <Gauge size={12} />} disabled={!serial || busy !== null} onClick={() => runGpuAction('benchmark_gpu')}>
            Probar Rendimiento GPU
          </Button>
          <Button size="sm" variant="secondary" icon={<RefreshCw size={12} />} disabled={!serial || busy !== null} onClick={loadGpu}>
            Detectar GPU
          </Button>
        </div>
      </div>

      {info && (
        <div className={`rounded-xl border p-3 text-xs space-y-1.5 ${boxCls}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{info.gpuFamily}</Badge>
            <Badge tone={info.vulkanSupported ? 'neutral' : 'warning'}>{info.vulkanSupported ? `Vulkan OK (${info.vulkanFeatures.length} caps)` : 'Sin Vulkan'}</Badge>
            {info.socPlatform && <Badge tone="neutral">SoC: {info.socPlatform}</Badge>}
            <Badge tone="neutral">HWUI: {info.hwuiRenderer}</Badge>
          </div>
          <p className={`font-mono text-[11px] break-all ${mutedCls}`}>{info.glesInfo}</p>
          {info.driverPackages.length > 0 && (
            <p className={`font-mono text-[10px] ${mutedCls}`}>Paquetes driver instalados: {info.driverPackages.join(', ')}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className={`rounded-lg border p-2.5 flex flex-wrap items-center justify-between gap-2 ${boxCls}`}>
          <div>
            <p className="text-xs font-semibold flex items-center gap-1"><Flame size={12} /> Motor Vulkan / OpenGL / ANGLE</p>
            <p className={`text-[10px] font-mono ${mutedCls}`}>debug.hwui.renderer + ANGLE</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {[{ id: 'default', label: 'Auto' }, { id: 'skiavk', label: 'Vulkan' }, { id: 'skiagl', label: 'SkiaGL' }, { id: 'angle', label: 'ANGLE+VK' }].map((m) => (
              <button key={m.id} type="button" disabled={!serial || busy !== null} onClick={() => runGpuAction('set_renderer', { renderer: m.id })} className={chipCls(info?.hwuiRenderer === m.id)}>{m.label}</button>
            ))}
          </div>
        </div>

        <div className={`rounded-lg border p-2.5 flex flex-wrap items-center justify-between gap-2 ${boxCls}`}>
          <div>
            <p className="text-xs font-semibold">Updatable / Game Graphics Driver</p>
            <p className={`text-[10px] font-mono ${mutedCls}`}>updatable_driver_all_apps</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {[{ id: '0', label: 'Default' }, { id: '1', label: 'Game/Prod' }, { id: '2', label: 'Prerelease' }, { id: '3', label: 'Sistema' }].map((d) => (
              <button key={d.id} type="button" disabled={!serial || busy !== null} onClick={() => runGpuAction('set_updatable_driver', { mode: d.id })} className={chipCls(info?.updatableDriverMode === d.id)}>{d.label}</button>
            ))}
          </div>
        </div>
      </div>

      {bench.length > 0 && (
        <pre className={`rounded-xl border p-3 text-[11px] font-mono whitespace-pre-wrap ${boxCls}`}>
          {bench.join('\n')}
        </pre>
      )}
    </Card>
  );
};
