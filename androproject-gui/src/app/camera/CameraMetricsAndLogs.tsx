// ============================================================================
// ARCHIVO: CameraMetricsAndLogs.tsx
// QUÉ HACE: Renderiza la grilla de métricas WebRTC en vivo (FPS, resolución,
//           latencia, pérdida, jitter, bitrate) y la consola de logs de cámara.
// CÓMO FUNCIONA: Componentes presentacionales puros que colorean estados de
//           error/éxito/reconexión sin mantener estado ni timers propios.
// POR QUÉ: Separar métricas y logs mantiene `app/camera/page.tsx` < 150L (SRP).
// ============================================================================

'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { CameraMetrics } from './cameraTypes';

export function CameraMetricsGrid({ metrics }: { metrics: CameraMetrics }) {
  const items = [
    { label: 'FPS', value: metrics.fps, unit: '', color: 'text-zinc-100' },
    { label: 'Resolución', value: metrics.resolution, unit: '', color: 'text-zinc-200' },
    { label: 'Latencia', value: metrics.latencyMs, unit: 'ms', color: 'text-zinc-200' },
    { label: 'Pérdida', value: metrics.packetsLost, unit: 'pkg', color: metrics.packetsLost > 10 ? 'text-red-400' : 'text-zinc-400' },
    { label: 'Jitter', value: metrics.jitter, unit: 'ms', color: 'text-zinc-300' },
    { label: 'Bitrate', value: metrics.bitrate, unit: 'Mbps', color: 'text-zinc-200' },
  ];

  return (
    <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 grid grid-cols-3 gap-3 shadow-xl backdrop-blur-sm">
      {items.map(({ label, value, unit, color }) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">{label}</span>
          <span className={`text-lg font-bold ${color} tabular-nums`}>
            {typeof value === 'number' ? value : value || '--'}
          </span>
          {unit && <span className="text-[8px] text-zinc-500">{unit}</span>}
        </div>
      ))}
    </div>
  );
}

export function CameraReconnectingBanner() {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 flex items-center gap-3">
      <RefreshCw size={16} className="text-zinc-300 animate-spin" />
      <span className="text-xs text-zinc-200 font-semibold">Reconectando automáticamente...</span>
    </div>
  );
}

export function CameraActivityLogs({ logs }: { logs: string[] }) {
  return (
    <div className="flex-1 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-2 min-h-[120px] max-h-[220px] overflow-y-auto">
      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Actividad de conexión</span>
      <div className="flex flex-col gap-1 text-[10px] font-mono text-zinc-400">
        {logs.length === 0 ? (
          <span className="text-zinc-600 italic">Sin actividad reciente.</span>
        ) : (
          logs.map((log, i) => {
            const lower = log.toLowerCase();
            const colorClass = (lower.includes('falló') || lower.includes('límite') || lower.includes('no se pudo'))
              ? 'text-red-400'
              : (lower.includes('activa') || lower.includes('completada') || lower.includes('recibido') || lower.includes('guardada'))
                ? 'text-emerald-400'
                : (lower.includes('interrumpida') || lower.includes('reiniciando') || lower.includes('reconectando'))
                  ? 'text-amber-400'
                  : 'text-zinc-400';
            return <div key={i} className={colorClass}>{log}</div>;
          })
        )}
      </div>
    </div>
  );
}
