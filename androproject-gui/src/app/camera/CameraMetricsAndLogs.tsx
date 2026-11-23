// ============================================================================
// ARCHIVO: CameraMetricsAndLogs.tsx
// QUÉ HACE: Renderiza la grilla de métricas WebRTC en vivo (FPS, resolución,
//           latencia, pérdida, jitter, bitrate) y la consola de logs de cámara.
// CÓMO FUNCIONA: Componentes presentacionales puros con tipografía monocroma
//           de alto contraste sin textos diminutos ni colores neón.
// POR QUÉ: Separar métricas y logs mantiene `app/camera/page.tsx` < 150L (SRP).
// ============================================================================

'use client';

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
    <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface-card p-4 shadow-sm sm:grid-cols-3">
      {items.map(({ label, value, unit }) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-text-secondary">{label}</span>
          <span className="text-lg font-bold text-text-primary tabular-nums">
            {typeof value === 'number' ? value : value || '--'}
          </span>
          {unit && <span className="text-[10px] text-text-tertiary">{unit}</span>}
        </div>
      ))}
    </div>
  );
}

export function CameraReconnectingBanner() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface-card p-3">
      <RefreshCw size={16} className="text-semantic-warning animate-spin" />
      <span className="text-xs text-text-primary font-semibold">Reconectando automáticamente...</span>
    </div>
  );
}

export function CameraActivityLogs({ logs }: { logs: string[] }) {
  return (
    <div className="flex max-h-[220px] min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-surface-card p-4">
      <span className="text-sm font-bold text-text-primary">Actividad de conexión</span>
      <div className="flex flex-col gap-1 text-[11px] font-mono text-text-secondary">
        {logs.length === 0 ? (
          <span className="text-text-tertiary italic">Sin actividad reciente.</span>
        ) : (
          logs.map((log, i) => <div key={i} className="text-text-secondary">{log}</div>)
        )}
      </div>
    </div>
  );
}
