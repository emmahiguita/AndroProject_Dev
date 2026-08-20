'use client';

import React from 'react';
import { Maximize, Minimize, RefreshCw, Smartphone } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useActions } from '@/hooks/useActions';
import { useSplitPanel } from '@/hooks/useSplitPanel';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useProjection } from '@/hooks/useProjection';
import { ViewShell } from '@/components/ViewShell';
import { SplitDivider } from '@/components/projection/SplitDivider';
import { EmptyState } from '@/components/projection/EmptyState';
import { DeviceFrame } from '@/components/layout/DeviceFrame';
import { DeviceInfoPanel } from '@/components/projection/DeviceInfoPanel';
import type { DeviceInfo, NavSection } from './types';

interface ProjectionViewProps {
  device?: DeviceInfo | null;
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onNavigate?: (section: NavSection) => void;
}

/**
 * ProjectionView — Real-time device screen projection.
 *
 * Composes:
 *   - useSplitPanel   (drag-to-resize)
 *   - useMediaQuery   (responsive breakpoint)
 *   - useProjection   (scrcpy lifecycle, fullscreen, ADB commands)
 *   - DeviceFrame     (live screen + interaction)
 *   - DeviceInfoPanel (device details + controls)
 */
export function ProjectionView({ device }: ProjectionViewProps) {
  const { dark } = useTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { ratio, isDragging, containerRef, onPointerDown, onPointerMove, onPointerUp, onKeyDown } = useSplitPanel({ defaultRatio: 0.60 });
  const projection = useProjection(device);

  if (!device) {
    return (
      <ViewShell navId="projection" fill>
        <EmptyState dark={dark} />
      </ViewShell>
    );
  }

  /* ── MOBILE LAYOUT ── */
  if (isMobile) {
    return (
      <ViewShell navId="projection" fill>
        <MobileProjection device={device} dark={dark} projection={projection} />
      </ViewShell>
    );
  }

  /* ── DESKTOP LAYOUT ── */
  return (
    <ViewShell navId="projection" fill>
      <div className="flex flex-col h-full min-h-0">
        {/* Page header */}
        <div className="flex items-center justify-between shrink-0 pb-2">
          <div>
            <h1 className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>Proyeccion</h1>
            <p className={`text-[10px] ${dark ? 'text-white/40' : 'text-slate-400'}`}>
              Pantalla del dispositivo en tiempo real
            </p>
          </div>
          <div className="flex items-center gap-2">
            {projection.scrcpyActive && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[9px] font-semibold text-green-400">en vivo</span>
              </span>
            )}
          </div>
        </div>

        {/* Split container */}
        <div
          ref={containerRef}
          className={`flex-1 flex min-h-0 rounded-xl border overflow-hidden ${
            dark ? 'bg-white/[0.025] border-white/[0.07]' : 'bg-white border-slate-200 shadow-sm'
          } ${isDragging ? 'cursor-col-resize select-none' : ''}`}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ userSelect: isDragging ? 'none' : 'auto' }}
        >
          {/* LEFT — Device screen */}
          <div className="flex flex-col min-w-0 min-h-0" style={{ width: `${ratio * 100}%` }}>
            <DeviceFrame device={device} expanded={true} compact={false} onSendKey={projection.sendKey} />
          </div>

          {/* DIVIDER */}
          <SplitDivider
            dark={dark}
            isDragging={isDragging}
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            ratio={ratio}
          />

          {/* RIGHT — Info panel */}
          <div className="flex flex-col min-h-0 overflow-y-auto overflow-x-hidden" style={{ width: `${(1 - ratio) * 100}%`, minWidth: 0 }}>
            <DeviceInfoPanel
              device={device}
              dark={dark}
              scrcpyActive={projection.scrcpyActive}
              onToggleScrcpy={projection.toggleScrcpy}
              onScreenshot={projection.screenshot}
              onPowerOff={projection.powerOff}
              onReboot={projection.reboot}
              onGoBack={projection.goBack}
              onGoHome={projection.goHome}
              onOpenRecent={projection.openRecent}
              onVolumeUp={projection.volumeUp}
              onVolumeDown={projection.volumeDown}
            />
          </div>
        </div>
      </div>
    </ViewShell>
  );
}

/* ── MobileProjection — mobile-specific layout ─────────────── */
function MobileProjection({
  device, dark, projection,
}: {
  device: DeviceInfo;
  dark: boolean;
  projection: ReturnType<typeof useProjection>;
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mobile header */}
      <div className={`flex items-center justify-between shrink-0 px-3 py-2 border-b ${
        dark ? 'border-white/5 bg-white/[0.025]' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${projection.scrcpyActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className={`text-[11px] font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{device.model}</span>
        </div>
        <div className="flex items-center gap-1">
          {projection.scrcpyActive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="text-[8px] font-semibold text-green-400">EN VIVO</span>
            </span>
          )}
          <button
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

      {/* Bottom navigation bar */}
      <div className={`shrink-0 border-t px-3 py-2 ${dark ? 'border-white/5 bg-white/[0.025]' : 'border-slate-200 bg-slate-50'}`}>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <button
            onClick={projection.goBack}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-semibold transition-all ${
              dark
                ? 'bg-white/[0.03] text-white/50 border border-white/[0.06] active:bg-white/[0.08]'
                : 'bg-white text-slate-500 border border-slate-200 active:bg-slate-50'
            }`}
          >
            <Smartphone size={12} /> Atrás
          </button>
          <button
            onClick={projection.goHome}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-semibold transition-all ${
              dark
                ? 'bg-[#1bae6e]/15 text-[#22c97d] border border-[#1bae6e]/25 active:bg-[#1bae6e]/30'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200 active:bg-emerald-100'
            }`}
          >
            <Smartphone size={12} /> Inicio
          </button>
          <button
            onClick={projection.openRecent}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-semibold transition-all ${
              dark
                ? 'bg-white/[0.03] text-white/50 border border-white/[0.06] active:bg-white/[0.08]'
                : 'bg-white text-slate-500 border border-slate-200 active:bg-slate-50'
            }`}
          >
            <Smartphone size={12} /> Recientes
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={projection.toggleScrcpy}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              projection.scrcpyActive
                ? (dark ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-200')
                : (dark ? 'bg-[#22c97d]/10 text-[#22c97d] border border-[#22c97d]/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200')
            }`}
          >
            {projection.scrcpyActive ? 'Detener' : 'scrcpy'}
          </button>
          <button
            onClick={projection.screenshot}
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              dark ? 'bg-white/5 text-white/60 border border-white/10 active:bg-white/10' : 'bg-slate-100 text-slate-600 border border-slate-200 active:bg-slate-200'
            }`}
          >
            Captura
          </button>
        </div>
      </div>
    </div>
  );
}
