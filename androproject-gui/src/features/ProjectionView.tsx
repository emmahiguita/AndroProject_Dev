'use client';

import React, { useState } from 'react';
import { Maximize, Minimize, Sliders, Terminal, Bug, LayoutGrid, Smartphone } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useSplitPanel } from '@/hooks/useSplitPanel';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useProjection } from '@/hooks/useProjection';
import { useActions } from '@/hooks/useActions';
import { useAppStore } from '@/stores';
import { ViewShell } from '@/components/ViewShell';
import { SplitDivider } from '@/components/projection/SplitDivider';
import { EmptyState } from '@/components/projection/EmptyState';
import { DeviceFrame } from '@/components/layout/DeviceFrame';
import { DeviceInfoPanel } from '@/components/projection/DeviceInfoPanel';
import { LogcatInspectorPanel } from '@/components/projection/LogcatInspectorPanel';
import { MultiScreenGrid } from '@/components/projection/MultiScreenGrid';
import type { DeviceInfo } from './types';

interface ProjectionViewProps {
  device?: DeviceInfo | null;
}

/**
 * ProjectionView — Real-time device screen projection studio with Multi-Screen support.
 *
 * Clean Architecture (SOLID):
 *   - DeviceFrame: Screen canvas + touch/gestures + drag & drop + phone nav bar + clipboard.
 *   - DeviceInfoPanel: scrcpy native 60 FPS studio, screen recorder, quick tools.
 *   - LogcatInspectorPanel: Android Studio real-time Logcat stream & crash inspector.
 *   - MultiScreenGrid: Parallel multi-device concurrent display grid.
 */
export function ProjectionView({ device }: ProjectionViewProps) {
  const { dark } = useTheme();
  const { run } = useActions();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { ratio, isDragging, containerRef, onPointerDown, onPointerMove, onPointerUp, onKeyDown } = useSplitPanel({ defaultRatio: 0.58 });
  const projection = useProjection(device);
  const [activeTab, setActiveTab] = useState<'studio' | 'logcat'>('studio');

  const multiScreenEnabled = useAppStore((state) => state.multiScreenEnabled);
  const toggleMultiScreen = useAppStore((state) => state.toggleMultiScreen);
  const devicesList = useAppStore((state) => state.devicesList);

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
      <div className="flex flex-col flex-1 min-h-0">
        {/* Slim action bar — no redundant title, DeviceFrame already has its own header */}
        <div className="flex items-center justify-end shrink-0 pb-1 gap-2">
          {projection.scrcpyActive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> VisionNano 60 FPS Activo
            </span>
          )}
          {projection.isRecording && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[9px] font-bold text-red-400 animate-pulse">
              ● REC
            </span>
          )}

          <button
            type="button"
            onClick={toggleMultiScreen}
            title={multiScreenEnabled ? 'Volver a vista focal' : 'Activar cuadrícula multi-pantalla'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              multiScreenEnabled
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-500/20'
                : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <LayoutGrid size={12} />
            <span>{multiScreenEnabled ? 'Multi-Pantalla ON' : 'Multi-Pantalla'}</span>
          </button>

          <button
            type="button"
            onClick={projection.toggleFullscreen}
            title={projection.fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className={`p-1 rounded-xl border transition-all cursor-pointer ${
              dark
                ? 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {projection.fullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
          </button>
        </div>

        {/* Multi-Screen Grid View or Single Split View */}
        {multiScreenEnabled ? (
          <div className="flex-1 min-h-0 rounded-xl border border-white/10 bg-black/40 overflow-hidden">
            <MultiScreenGrid
              devices={devicesList.map(d => ({
                serial: d.serial,
                model: d.model || d.serial,
                platform: 'android',
                connected: true,
                connectionType: d.connectionType || 'USB',
              }))}
              onToggleScrcpy={(s) => {
                if (s && s !== device?.serial) {
                  run('open_screen', `Iniciando transmisión: ${s}...`, { serial: s });
                } else {
                  projection.toggleScrcpy();
                }
              }}
              dark={dark}
            />
          </div>
        ) : (
          /* Split container */
          <div
            ref={containerRef}
            className={`flex-1 flex min-h-0 rounded-t-xl overflow-hidden border-t border-x border-b-0 ${
              dark ? 'border-white/[0.07] bg-transparent' : 'border-slate-200 bg-white shadow-sm'
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

          {/* RIGHT — Studio Tools & Logcat Panel */}
          <div className="flex flex-col min-h-0 overflow-hidden" style={{ width: `${(1 - ratio) * 100}%`, minWidth: 0 }}>
            {/* Panel Mode Switcher Tabs */}
            <div className="flex items-center p-1.5 border-b border-zinc-800 bg-zinc-950/80 gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('studio')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'studio'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Sliders size={13} />
                <span>Estudio & Control</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('logcat')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'logcat'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Terminal size={13} />
                <span>Logcat & Crashes</span>
              </button>
            </div>

            {/* Active Panel View */}
            <div className={`flex-1 min-h-0 ${activeTab === 'studio' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden flex flex-col'}`}>
              {activeTab === 'studio' ? (
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
              ) : (
                <LogcatInspectorPanel
                  serial={device.serial}
                  dark={dark}
                />
              )}
            </div>
          </div>
        </div>
        )}
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
        dark ? 'border-zinc-800 bg-zinc-900/60' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${projection.scrcpyActive ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'}`} />
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
