// ── MobileProjection — mobile-specific projection layout ─────────
// SRP: renders the full-screen projection view optimized for mobile viewports.

'use client';

import React from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { DeviceFrame } from '@/components/layout/DeviceFrame';
import type { DeviceInfo } from '@/features/types';
import type { useProjection } from '@/hooks/useProjection';

interface MobileProjectionProps {
  device: DeviceInfo;
  dark: boolean;
  projection: ReturnType<typeof useProjection>;
}

export function MobileProjection({ device, dark, projection }: MobileProjectionProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mobile header */}
      <div className={`flex items-center justify-between shrink-0 px-3 py-2 border-b ${
        dark ? 'border-zinc-800 bg-zinc-900/60' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${projection.scrcpyActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'}`} />
          <span className={`text-[11px] font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{device.model}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={projection.toggleFullscreen}
            className={`p-1.5 rounded-lg transition-all ${
              dark ? 'bg-white/5 text-white/50 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {projection.fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>
      </div>

      {/* Device screen */}
      <div className="flex-1 flex items-center justify-center bg-black min-h-0">
        <DeviceFrame device={device} expanded={true} compact={true} onSendKey={projection.sendKey} />
      </div>
    </div>
  );
}
