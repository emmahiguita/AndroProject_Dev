// ============================================================================
// ARCHIVO: DeviceInfoPanel.tsx
// QUÉ HACE: Panel lateral del estudio de proyección que orquesta notificaciones
//           toast, portapapeles, capturas y delega la UI a tarjetas por plataforma.
// CÓMO FUNCIONA: Detecta si el dispositivo es iOS o Android para renderizar
//           `AirPlayStudioCard` o `VisionNanoStudioCard` + `ProjectionToolsCard`,
//           gestionando el temporizador único del toast sin fugas de memoria.
// POR QUÉ: Mantener este orquestador < 200 líneas (SRP) y corregir el toast
//           en capturas fallidas y herramientas Android mostradas en iOS.
// ============================================================================

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useActions } from '@/hooks/useActions';
import type { DeviceInfo } from '@/features/types';
import type { ScrcpyOptions } from '@/hooks/useProjection';
import type { RecordActionResult } from '@/hooks/useProjectionTypes';
import { AirPlayStudioCard } from './AirPlayStudioCard';
import { VisionNanoStudioCard } from './VisionNanoStudioCard';
import { ProjectionToolsCard } from './ProjectionToolsCard';

interface DeviceInfoPanelProps {
  device: DeviceInfo;
  dark: boolean;
  scrcpyActive: boolean;
  onToggleScrcpy: (opts?: Partial<ScrcpyOptions>) => void;
  scrcpyOptions: ScrcpyOptions;
  setScrcpyOptions: React.Dispatch<React.SetStateAction<ScrcpyOptions>>;
  isRecording: boolean;
  recordingSeconds: number;
  lastRecordedPath?: string | null;
  onToggleRecord: () => Promise<RecordActionResult> | void;
  onScreenshot: () => Promise<string | null> | void;
  onPowerOff: () => void;
  onReboot: () => void;
  onTogglePowerScreen: () => void;
  onWakeScreen?: () => void;
  onOpenAllApps?: () => void;
  onToggleMute?: () => void;
  onMediaPlayPause?: () => void;
  onOpenSettings?: () => void;
  onCollapsePanels?: () => void;
  onExpandNotifications: () => void;
  onExpandQuickSettings: () => void;
  onSetOrientation: (mode: 'auto' | 'portrait' | 'landscape') => void;
  isBusy: boolean;
  onConnectAdb?: (ip: string, port?: string) => Promise<{ success: boolean; message?: string }>;
  isConnecting?: boolean;
  autoProject?: boolean;
  onToggleAutoProject?: (v: boolean) => void;
  onMouseControl?: () => Promise<void> | void;
}

export const DeviceInfoPanel: React.FC<DeviceInfoPanelProps> = (props) => {
  const { device, dark } = props;
  const { run } = useActions();
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = useCallback((msg: string, isError = false) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, isError });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  const handleScreenshotClick = async () => {
    showToast('Capturando pantalla HD...');
    const savedPath = await props.onScreenshot();
    if (savedPath) {
      showToast('Captura guardada en Capturas');
    } else {
      showToast('Error al capturar pantalla', true);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { showToast('Portapapeles de la PC vacío'); return; }
      const res = await run('paste_clipboard', 'Pegar del PC', { text, serial: device.serial }, false);
      showToast(res?.success ? 'Texto pegado en el dispositivo' : 'Error al pegar en dispositivo', !res?.success);
    } catch {
      showToast('Permiso de portapapeles denegado', true);
    }
  };

  const cardStyle = `${dark ? 'bg-zinc-900/40 border-zinc-800/70' : 'bg-white border-slate-200 shadow-sm'}`;
  const isIos = device.platform === 'ios' || device.serial?.startsWith('airplay-') || device.serial?.startsWith('apple-');

  return (
    <div className="p-3 space-y-3 relative">
      {toast && (
        <div className="sticky top-2 z-30 flex items-center justify-center animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/95 border border-zinc-700 text-zinc-200 text-xs font-medium shadow-xl backdrop-blur-md">
            {toast.isError
              ? <AlertCircle size={13} className="text-rose-400" />
              : <CheckCircle2 size={13} className="text-emerald-400" />}
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      {isIos ? (
        <AirPlayStudioCard
          serial={device.serial} dark={dark} cardStyle={cardStyle}
          scrcpyOptions={props.scrcpyOptions} setScrcpyOptions={props.setScrcpyOptions}
          onMouseControl={props.onMouseControl} onScreenshotClick={handleScreenshotClick}
          onPasteClipboard={handlePasteClipboard} run={run} showToast={showToast}
        />
      ) : (
        <>
          <VisionNanoStudioCard
            dark={dark} cardStyle={cardStyle} scrcpyActive={props.scrcpyActive}
            isBusy={props.isBusy} onToggleScrcpy={props.onToggleScrcpy}
            scrcpyOptions={props.scrcpyOptions} setScrcpyOptions={props.setScrcpyOptions}
            autoProject={Boolean(props.autoProject)} onToggleAutoProject={props.onToggleAutoProject}
          />
          <ProjectionToolsCard
            dark={dark} cardStyle={cardStyle} isRecording={props.isRecording}
            recordingSeconds={props.recordingSeconds} lastRecordedPath={props.lastRecordedPath} isBusy={props.isBusy}
            onToggleRecord={props.onToggleRecord} onSetOrientation={props.onSetOrientation}
            onPasteClipboard={handlePasteClipboard} onScreenshotClick={handleScreenshotClick}
            onOpenAllApps={props.onOpenAllApps} onExpandNotifications={props.onExpandNotifications}
            onExpandQuickSettings={props.onExpandQuickSettings} onTogglePowerScreen={props.onTogglePowerScreen}
            onWakeScreen={props.onWakeScreen} onOpenSettings={props.onOpenSettings}
            onToggleMute={props.onToggleMute} onMediaPlayPause={props.onMediaPlayPause}
            onCollapsePanels={props.onCollapsePanels} onReboot={props.onReboot}
            onPowerOff={props.onPowerOff} showToast={showToast}
          />
        </>
      )}
    </div>
  );
};
