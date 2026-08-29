'use client';

import React from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useSplitPanel } from '@/hooks/useSplitPanel';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useProjection } from '@/hooks/useProjection';
import { ViewShell } from '@/components/ViewShell';
import { SplitDivider } from '@/components/projection/SplitDivider';
import { EmptyState } from '@/components/projection/EmptyState';
import { DeviceFrame } from '@/components/layout/DeviceFrame';
import { DeviceInfoPanel } from '@/components/projection/DeviceInfoPanel';
import type { DeviceInfo } from './types';

interface ProjectionViewProps {
  device?: DeviceInfo | null;
}

/**
 * ProjectionView — Real-time device screen projection studio.
 *
 * Clean Architecture (SOLID):
 *   - DeviceFrame: Screen canvas + touch/gestures + drag & drop + phone nav bar.
 *   - DeviceInfoPanel: scrcpy native 60 FPS studio, screen recorder, quick tools.
 *   - Zero duplicate components across panels.
 */
export function ProjectionView({ device }: ProjectionViewProps) {
  const { dark } = useTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { ratio, isDragging, containerRef, onPointerDown, onPointerMove, onPointerUp, onKeyDown } = useSplitPanel({ defaultRatio: 0.62 });
  const projection = useProjection(device);

  if (!device) {
    return (
      <ViewShell navId="projection" fill>
        <EmptyState dark={dark} onConnectAdb={projection.connectAdb} isConnecting={projection.isConnecting} />
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
            <div className="flex items-center gap-2">
              <h1 className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
                Proyección y Control
              </h1>
              {projection.scrcpyActive && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> VisionNano 60 FPS
                </span>
              )}
              {projection.isRecording && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[9px] font-bold text-red-400 animate-pulse">
                  REC
                </span>
              )}
            </div>
            <p className={`text-[10px] ${dark ? 'text-white/40' : 'text-slate-400'}`}>
              Pantalla interactiva en tiempo real con transmisión nativa por aceleración de hardware
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={projection.toggleFullscreen}
              title={projection.fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              className={`p-1.5 rounded-xl border transition-all ${
                dark
                  ? 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {projection.fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            </button>
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
          {/* LEFT — Interactive Device Frame */}
          <div className="flex flex-col min-w-0 min-h-0" style={{ width: `${ratio * 100}%` }}>
            <DeviceFrame
              device={device}
              expanded={true}
              compact={false}
              onSendKey={projection.sendKey}
              scrcpyActive={projection.scrcpyActive}
              onToggleScrcpy={projection.toggleScrcpy}
            />
          </div>

          {/* DIVIDER */}
          <SplitDivider
            dark={dark}
            isDragging={isDragging}
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            ratio={ratio}
          />

          {/* RIGHT — Studio Tools Panel */}
          <div className="flex flex-col min-h-0 overflow-y-auto overflow-x-hidden" style={{ width: `${(1 - ratio) * 100}%`, minWidth: 0 }}>
            <DeviceInfoPanel
              device={device}
              dark={dark}
              scrcpyActive={projection.scrcpyActive}
              onToggleScrcpy={projection.toggleScrcpy}
              scrcpyOptions={projection.scrcpyOptions}
              setScrcpyOptions={projection.setScrcpyOptions}
              isRecording={projection.isRecording}
              recordingSeconds={projection.recordingSeconds}
              onToggleRecord={projection.toggleRecord}
              onScreenshot={projection.screenshot}
              onPowerOff={projection.powerOff}
              onReboot={projection.reboot}
              onTogglePowerScreen={projection.togglePowerScreen}
              onWakeScreen={projection.wakeScreen}
              onOpenAllApps={projection.openAllApps}
              onToggleMute={projection.toggleMute}
              onMediaPlayPause={projection.mediaPlayPause}
              onOpenSettings={projection.openSettings}
              onCollapsePanels={projection.collapsePanels}
              onExpandNotifications={projection.expandNotifications}
              onExpandQuickSettings={projection.expandQuickSettings}
              onSetOrientation={projection.setOrientation}
              isBusy={projection.isBusy}
              onConnectAdb={projection.connectAdb}
              isConnecting={projection.isConnecting}
              autoProject={projection.autoProject}
              onToggleAutoProject={projection.setAutoProject}
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
          <div className={`w-2 h-2 rounded-full ${projection.scrcpyActive ? 'bg-green-500 animate-pulse' : 'bg-[#22c97d]'}`} />
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
