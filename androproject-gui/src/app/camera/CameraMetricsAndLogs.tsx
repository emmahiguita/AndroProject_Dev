// ============================================================================
// ARCHIVO: CameraMetricsAndLogs.tsx
// QUÉ HACE: Renderiza la grilla de métricas WebRTC en vivo (FPS, resolución,
//           latencia, pérdida, jitter, bitrate) y la consola de logs de cámara.
// CÓMO FUNCIONA: Componentes presentacionales puros con tipografía monocroma
//           de alto contraste sin textos diminutos ni colores neón.
// POR QUÉ: Separar métricas y logs mantiene `app/camera/page.tsx` < 150L (SRP).
// ============================================================================

'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { CameraMetrics } from './cameraTypes';

export function CameraMetricsGrid({ metrics }: { metrics: CameraMetrics }) {
  const items = [
    { label: 'FPS', value: metrics.fps, unit: '' },
    { label: 'Resolución', value: metrics.resolution, unit: '' },
    { label: 'Latencia', value: metrics.latencyMs, unit: 'ms' },
    { label: 'Pérdida', value: metrics.packetsLost, unit: 'pkg' },
    { label: 'Jitter', value: metrics.jitter, unit: 'ms' },
    { label: 'Bitrate', value: metrics.bitrate, unit: 'Mbps' },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 grid grid-cols-3 gap-3 shadow-xl">
      {items.map(({ label, value, unit }) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-zinc-300 uppercase font-bold tracking-wider">{label}</span>
          <span className="text-lg font-bold text-zinc-100 tabular-nums">
            {typeof value === 'number' ? value : value || '--'}
          </span>
          {unit && <span className="text-[10px] text-zinc-400">{unit}</span>}
        </div>
      ))}
    </div>
  );
}

export function CameraReconnectingBanner() {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 flex items-center gap-3">
      <RefreshCw size={16} className="text-zinc-300 animate-spin" />
      <span className="text-xs text-zinc-100 font-semibold">Reconectando automáticamente...</span>
    </div>
  );
}

export function CameraActivityLogs({ logs }: { logs: string[] }) {
  return (
    <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-2 min-h-[120px] max-h-[220px] overflow-y-auto">
      <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Actividad de conexión</span>
      <div className="flex flex-col gap-1 text-[11px] font-mono text-zinc-200">
        {logs.length === 0 ? (
          <span className="text-zinc-400 italic">Sin actividad reciente.</span>
        ) : (
          logs.map((log, i) => <div key={i} className="text-zinc-200">{log}</div>)
        )}
      </div>
    </div>
  );
}
