// ============================================================================
// ARCHIVO: ProjectionView.tsx
// QUÉ HACE: Estudio de proyección interactiva 60 FPS con soporte de panel
//           dividido (visor + Estudio/Logcat), modo Multi-Pantalla paralelo,
//           ventana flotante (Popout Tauri/Web) y colapso al minimizar.
// CÓMO FUNCIONA: Coordina `ProjectionToolbar`, `DeviceFrame`, `MultiScreenGrid`
//           y las pestañas de Estudio/Logcat conectando todas las acciones de
//           `useProjection` sin dejar funciones huérfanas.
// POR QUÉ: Mantener una interfaz fluida, responsiva y bajo 200 líneas (SOLID).
// ============================================================================
'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Sliders, Terminal } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useSplitPanel } from '@/hooks/useSplitPanel';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useProjection } from '@/hooks/useProjection';
import { useActions } from '@/hooks/useActions';
import { useAppStore } from '@/stores';
import { rustBridge } from '@/lib/services/tauri-bridge';
import { ViewShell } from '@/components/ViewShell';
import { SplitDivider } from '@/components/projection/SplitDivider';
import { EmptyState } from '@/components/projection/EmptyState';
import { DeviceFrame } from '@/components/layout/DeviceFrame';
import { DeviceInfoPanel } from '@/components/projection/DeviceInfoPanel';
import { LogcatInspectorPanel } from '@/components/projection/LogcatInspectorPanel';
import { MultiScreenGrid } from '@/components/projection/MultiScreenGrid';
import { MobileProjection } from '@/components/projection/MobileProjection';
import { ProjectionToolbar } from '@/components/projection/ProjectionToolbar';
import type { DeviceInfo } from './types';

export function ProjectionView({ device }: { device?: DeviceInfo | null }) {
  const { dark } = useTheme();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { ratio, isDragging, containerRef, onPointerDown, onPointerMove, onPointerUp, onKeyDown } = useSplitPanel({ defaultRatio: 0.58 });
  const projection = useProjection(device);
  const { run } = useActions();
  const [activeTab, setActiveTab] = useState<'studio' | 'logcat'>('studio');
  const [frameMinimized, setFrameMinimized] = useState(false);

  const multiScreenEnabled = useAppStore((s) => s.multiScreenEnabled);
  const setMultiScreenEnabled = useAppStore((s) => s.setMultiScreenEnabled);
  const toggleMultiScreen = useAppStore((s) => s.toggleMultiScreen);
  const devicesList = useAppStore((s) => s.devicesList);

  // Deduplicación de dispositivos físicos (si un teléfono está por USB y Wi-Fi a la vez, prioriza USB)
  const uniqueDevices = useMemo(() => {
    const base = devicesList.length > 0 ? devicesList : (device ? [device] : []);
    const usbModels = new Set(base.filter((d) => !d.serial.includes(':') && d.model).map((d) => d.model!.trim().toLowerCase()));
    return base.filter((d) => !(d.serial.includes(':') && d.model && usbModels.has(d.model.trim().toLowerCase())));
  }, [devicesList, device]);

  const multiScreenDevices = useMemo(() => uniqueDevices.map((d) => {
    const isIos = d.serial.startsWith('airplay-') || d.serial.startsWith('apple-');
    return {
      serial: d.serial, model: d.model || d.serial, platform: (isIos ? 'ios' : 'android') as 'ios' | 'android',
      state: (('state' in d && d.state) ? d.state : 'device') as 'device', connected: true, connectionType: d.connectionType || (isIos ? 'Wi-Fi' : 'USB'),
    };
  }), [uniqueDevices]);

  // Activa automáticamente Multi-Pantalla cuando se detectan 2 o más móviles físicos
  const prevDevCountRef = useRef(0);
  useEffect(() => {
    const count = uniqueDevices.length;
    if (count >= 2 && prevDevCountRef.current < 2) setMultiScreenEnabled(true);
    else if (count <= 1 && prevDevCountRef.current >= 2) setMultiScreenEnabled(false);
    prevDevCountRef.current = count;
  }, [uniqueDevices.length, setMultiScreenEnabled]);

  const handleOpenPopout = useCallback(async () => {
    if (!device?.serial) return;
    if (rustBridge.isDesktop()) {
      await rustBridge.openPopout(device.serial);
      return;
    }
    window.open(
      `/popout?serial=${encodeURIComponent(device.serial)}`,
      `popout_${device.serial.replace(/[^a-zA-Z0-9]/g, '_')}`,
      'width=420,height=860,left=80,top=80,resizable=yes,scrollbars=no,status=no',
    );
  }, [device?.serial]);

  if (!device) return <ViewShell navId="projection" fill><EmptyState dark={dark} onConnectAdb={projection.connectAdb} isConnecting={projection.isConnecting} /></ViewShell>;
  if (isMobile) return <ViewShell navId="projection" fill><MobileProjection device={device} dark={dark} projection={projection} /></ViewShell>;

  const handleProjectAll = () => {
    uniqueDevices.forEach((d) => {
      const isIos = d.serial.startsWith('airplay-') || d.serial.startsWith('apple-');
      run('open_screen', `Proyectando ${d.model || d.serial}...`, { serial: d.serial, platform: isIos ? 'ios' : 'android' }, false);
    });
  };

  return (
    <ViewShell navId="projection" fill>
      <div className="flex flex-col flex-1 min-h-0">
        <ProjectionToolbar
          dark={dark} scrcpyActive={projection.scrcpyActive} isBusy={projection.isBusy}
          isRecording={projection.isRecording} recordingSeconds={projection.recordingSeconds}
          onToggleScrcpy={() => projection.toggleScrcpy()} onToggleRecord={projection.toggleRecord}
          onScreenshot={() => { projection.screenshot(); }} onPopout={handleOpenPopout}
          fullscreen={projection.fullscreen} minimized={frameMinimized}
          deviceLabel={device.model || device.serial} multiScreenEnabled={multiScreenEnabled}
          deviceCount={uniqueDevices.length} onRestoreMinimize={() => setFrameMinimized(false)}
          onProjectAll={handleProjectAll} onToggleMultiScreen={toggleMultiScreen}
          onToggleFullscreen={projection.toggleFullscreen}
        />

        {multiScreenEnabled ? (
          <div className={`flex-1 min-h-0 rounded-xl border overflow-hidden ${dark ? 'border-zinc-800 bg-zinc-950' : 'border-slate-200 bg-slate-50'}`}>
            <MultiScreenGrid
              devices={multiScreenDevices}
              onToggleScrcpy={(s) => {
                if (s && s !== device.serial) {
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
          <div
            ref={containerRef}
            className={`flex-1 flex min-h-0 rounded-t-xl overflow-hidden border-t border-x border-b-0 ${dark ? 'border-white/[0.07]' : 'border-slate-200 bg-white shadow-sm'} ${isDragging ? 'cursor-col-resize select-none' : ''}`}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ userSelect: isDragging ? 'none' : 'auto' }}
          >
            {!frameMinimized && (
              <>
                <div className="flex flex-col min-w-0 min-h-0" style={{ width: `${ratio * 100}%` }}>
                  <DeviceFrame
                    device={device} expanded={true} onSendKey={projection.sendKey}
                    scrcpyActive={projection.scrcpyActive} onToggleScrcpy={projection.toggleScrcpy}
                    isRecording={projection.isRecording} recordingSeconds={projection.recordingSeconds}
                    onToggleRecord={projection.toggleRecord} minimized={frameMinimized}
                    onToggleMinimize={() => setFrameMinimized((m) => !m)}
                  />
                </div>
                <SplitDivider dark={dark} isDragging={isDragging} onPointerDown={onPointerDown} onKeyDown={onKeyDown} ratio={ratio} />
              </>
            )}

            <div className="flex flex-col min-h-0 overflow-hidden" style={{ width: frameMinimized ? '100%' : `${(1 - ratio) * 100}%`, minWidth: 0 }}>
              <div className="flex items-center p-1.5 border-b border-zinc-800 bg-zinc-950/80 gap-1 shrink-0">
                <button
                  type="button" onClick={() => setActiveTab('studio')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'studio' ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <Sliders size={13} /> <span>Estudio &amp; Control</span>
                </button>
                <button
                  type="button" onClick={() => setActiveTab('logcat')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'logcat' ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <Terminal size={13} /> <span>Logcat &amp; Crashes</span>
                </button>
              </div>

              <div className={`flex-1 min-h-0 ${activeTab === 'studio' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden flex flex-col'}`}>
                {activeTab === 'studio' ? (
                  <DeviceInfoPanel
                    device={device} dark={dark} scrcpyActive={projection.scrcpyActive} onToggleScrcpy={projection.toggleScrcpy}
                    scrcpyOptions={projection.scrcpyOptions} setScrcpyOptions={projection.setScrcpyOptions}
                    isRecording={projection.isRecording} recordingSeconds={projection.recordingSeconds}
                    lastRecordedPath={projection.lastRecordedPath} onToggleRecord={projection.toggleRecord}
                    onScreenshot={projection.screenshot} onPowerOff={projection.powerOff} onReboot={projection.reboot}
                    onTogglePowerScreen={projection.togglePowerScreen} onWakeScreen={projection.wakeScreen}
                    onOpenAllApps={projection.openAllApps} onGoBack={projection.goBack} onGoHome={projection.goHome}
                    onOpenRecent={projection.openRecent} onVolumeUp={projection.volumeUp} onVolumeDown={projection.volumeDown}
                    onToggleMute={projection.toggleMute} onMediaPlayPause={projection.mediaPlayPause}
                    onOpenSettings={projection.openSettings} onCollapsePanels={projection.collapsePanels}
                    onExpandNotifications={projection.expandNotifications} onExpandQuickSettings={projection.expandQuickSettings}
                    onSetOrientation={projection.setOrientation} isBusy={projection.isBusy} onConnectAdb={projection.connectAdb}
                    isConnecting={projection.isConnecting} autoProject={projection.autoProject} onToggleAutoProject={projection.setAutoProject}
                  />
                ) : (
                  <LogcatInspectorPanel serial={device.serial} dark={dark} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ViewShell>
  );
}
