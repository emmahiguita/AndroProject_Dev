'use client';

import React, { useState } from 'react';
import { Maximize, Minimize, Sliders, Terminal, LayoutGrid } from 'lucide-react';
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
import { MobileProjection } from '@/components/projection/MobileProjection';
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
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { ratio, isDragging, containerRef, onPointerDown, onPointerMove, onPointerUp, onKeyDown } = useSplitPanel({ defaultRatio: 0.58 });
  const projection = useProjection(device);
  const { run } = useActions();
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
            <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[10px] font-medium ${
              dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> VisionNano 60 FPS Activo
            </span>
          )}
          {projection.isRecording && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[9px] font-bold text-red-400 animate-pulse">
              ● REC
            </span>
          )}

          {multiScreenEnabled && devicesList.length > 0 && (
            <button
              type="button"
              onClick={() => {
                devicesList.forEach((d) => {
                  const isIos = d.serial.startsWith('airplay-') || d.serial.startsWith('apple-');
                  run('open_screen', `Proyectando ${d.model || d.serial}...`, {
                    serial: d.serial,
                    platform: isIos ? 'ios' : 'android',
                  }, false);
                });
              }}
              title="Lanzar proyección nativa 60 FPS para todos los dispositivos conectados"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                dark
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                  : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span>Proyectar Todas ({devicesList.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleMultiScreen}
            title={multiScreenEnabled ? 'Volver a vista focal' : 'Activar cuadrícula multi-pantalla'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
              multiScreenEnabled
                ? (dark
                    ? 'bg-zinc-100 border-zinc-100 text-zinc-950'
                    : 'bg-zinc-900 border-zinc-900 text-white')
                : (dark
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50')
            }`}
          >
            <LayoutGrid size={12} />
            <span>{multiScreenEnabled ? 'Multi-Pantalla ON' : `Multi-Pantalla${devicesList.length > 1 ? ` (${devicesList.length})` : ''}`}</span>
          </button>

          <button
            type="button"
            onClick={projection.toggleFullscreen}
            title={projection.fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              dark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {projection.fullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
          </button>
        </div>

        {/* Multi-Screen Grid View or Single Split View */}
        {multiScreenEnabled ? (
          <div className={`flex-1 min-h-0 rounded-xl border overflow-hidden ${
            dark ? 'border-zinc-800 bg-zinc-950' : 'border-slate-200 bg-slate-50'
          }`}>
            <MultiScreenGrid
              devices={(devicesList.length > 0 ? devicesList : [device]).map((d) => {
                const isIos = d.serial.startsWith('airplay-') || d.serial.startsWith('apple-');
                return {
                  serial: d.serial,
                  model: d.model || d.serial,
                  platform: isIos ? 'ios' : 'android',
                  connected: true,
                  connectionType: d.connectionType || (isIos ? 'Wi-Fi' : 'USB'),
                };
              })}
              onToggleScrcpy={(s) => {
                if (s && s !== device?.serial) {
                  const isIos = s.startsWith('airplay-') || s.startsWith('apple-');
                  run('open_screen', `Iniciando transmisión: ${s}...`, { serial: s, platform: isIos ? 'ios' : 'android' });
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

