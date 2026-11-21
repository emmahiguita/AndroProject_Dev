// ============================================================================
// ARCHIVO: FlasherView.tsx
// QUÉ HACE: Orquestador del módulo Flasheador (Bootloader, Particiones A/B,
//           Fastboot .img y ADB Sideload .zip).
// CÓMO FUNCIONA: Al montar o cambiar de dispositivo (`activeSerial`), consulta
//           automáticamente `/api/flash` (`check_state`) para leer el modo real
//           y las variables del bootloader (`ro.boot.*` o `fastboot getvar`).
// POR QUÉ: Reemplazar el archivo monolítico de 447 líneas con arquitectura
//           limpia, detección automática en vivo y < 200 líneas (SOLID).
// ============================================================================
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { PARTITIONS } from './flasher/flasher-partitions';
import { FlasherBootloaderPanel } from './flasher/FlasherBootloaderPanel';
import { FlasherImagePanel } from './flasher/FlasherImagePanel';
import type { DeviceInfo } from './types';

interface FlasherViewProps {
  device?: DeviceInfo | null;
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function FlasherView({ addLog: propAddLog }: FlasherViewProps = {}) {
  const { dark } = useTheme();
  const flashState = useAppStore((s) => s.flashState);
  const setFlashState = useAppStore((s) => s.setFlashState);
  const flashInfo = useAppStore((s) => s.flashInfo);
  const setFlashInfo = useAppStore((s) => s.setFlashInfo);
  const selectedPartition = useAppStore((s) => s.selectedPartition);
  const setSelectedPartition = useAppStore((s) => s.setSelectedPartition);
  const flashFile = useAppStore((s) => s.flashFile);
  const setFlashFile = useAppStore((s) => s.setFlashFile);
  const flashing = useAppStore((s) => s.flashing);
  const setFlashing = useAppStore((s) => s.setFlashing);
  const flashProgress = useAppStore((s) => s.flashProgress);
  const setFlashProgress = useAppStore((s) => s.setFlashProgress);
  const activeSerial = useAppStore((s) => s.activeSerial);
  const storeAddLog = useAppStore((s) => s.addLog);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [cmdResult, setCmdResult] = useState<{ text: string; isError: boolean } | null>(null);

  const log = useCallback(
    (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
      if (propAddLog) propAddLog(msg, type);
      else storeAddLog(msg, new Date().toLocaleTimeString(), type);
    },
    [propAddLog, storeAddLog],
  );

  // Detección real automática del estado (ADB / Fastboot / Recovery) y variables de arranque
  const detectDeviceState = useCallback(async () => {
    setBusyAction('check_state');
    try {
      const fd = new FormData();
      fd.append('action', 'check_state');
      if (activeSerial) fd.append('serial', activeSerial);
      const r = await fetch('/api/flash', { method: 'POST', body: fd });
      const d = await r.json();
      setFlashState(d.state || 'unknown');
      setFlashInfo(d.deviceInfo || {});
      log(`Estado Flasheador: ${d.state || 'unknown'} (${d.deviceInfo?.product || activeSerial || '--'})`);
    } catch {
      log('Error al consultar estado de Fastboot/ADB', 'error');
    } finally {
      setBusyAction(null);
    }
  }, [activeSerial, setFlashState, setFlashInfo, log]);

  useEffect(() => {
    detectDeviceState();
  }, [detectDeviceState]);

  // Ejecución genérica de acciones de Bootloader / Reinicio / OEM
  const handleRunAction = async (
    action: string,
    confirmMsg?: string,
    extra?: Record<string, string>,
  ) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusyAction(action);
    setCmdResult(null);
    try {
      const fd = new FormData();
      fd.append('action', action);
      if (activeSerial) fd.append('serial', activeSerial);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) fd.append(k, v);
      }
      const r = await fetch('/api/flash', { method: 'POST', body: fd });
      const d = await r.json();
      const msg = d.message || d.info || d.error || 'Comando procesado.';
      setCmdResult({ text: msg, isError: !d.success });
      log(msg, d.success ? 'success' : 'error');
      if (action.startsWith('reboot_') || action.startsWith('fastboot_')) {
        setTimeout(detectDeviceState, 2200);
      }
    } catch {
      setCmdResult({ text: 'Error de comunicación con /api/flash.', isError: true });
    } finally {
      setBusyAction(null);
    }
  };

  // Ejecución de flasheo de partición (.img)
  const handleExecuteFlash = async () => {
    if (!flashFile) return;
    const partObj = PARTITIONS.find((p) => p.id === selectedPartition);
    const isCritical = partObj?.critical === true;
    if (!confirm(`¿Flashear "${flashFile.name}" en la partición "${selectedPartition}"?`)) return;
    if (isCritical && !confirm(`ADVERTENCIA CRÍTICA: "${selectedPartition}" es una partición de bajo nivel. ¿Confirmas continuar?`)) return;

    setFlashing(true);
    setFlashProgress(`Flasheando ${selectedPartition}...`);
    setCmdResult(null);
    try {
      const fd = new FormData();
      fd.append('action', 'flash');
      fd.append('file', flashFile);
      fd.append('partition', selectedPartition);
      if (isCritical) fd.append('confirmCritical', 'true');
      if (activeSerial) fd.append('serial', activeSerial);
      const r = await fetch('/api/flash', { method: 'POST', body: fd });
      const d = await r.json();
      const msg = d.message || d.error || 'Operación finalizada.';
      setCmdResult({ text: msg, isError: !d.success });
      setFlashProgress(d.success ? 'Completado' : 'Error');
      log(msg, d.success ? 'success' : 'error');
    } catch {
      setCmdResult({ text: 'Error de red durante el flasheo.', isError: true });
    } finally {
      setFlashing(false);
    }
  };

  // Ejecución de ADB Sideload (.zip)
  const handleExecuteSideload = async (file: File) => {
    if (!confirm(`¿Enviar "${file.name}" vía ADB Sideload?`)) return;
    setFlashing(true);
    setFlashProgress('Enviando ZIP por sideload...');
    setCmdResult(null);
    try {
      const fd = new FormData();
      fd.append('action', 'sideload');
      fd.append('file', file);
      if (activeSerial) fd.append('serial', activeSerial);
      const r = await fetch('/api/flash', { method: 'POST', body: fd });
      const d = await r.json();
      const msg = d.message || d.error || 'Sideload finalizado.';
      setCmdResult({ text: msg, isError: !d.success });
      log(msg, d.success ? 'success' : 'error');
    } catch {
      setCmdResult({ text: 'Error de conexión durante ADB Sideload.', isError: true });
    } finally {
      setFlashing(false);
    }
  };

  return (
    <ViewShell navId="flasher">
      <div className="mx-auto w-full max-w-4xl space-y-3">
        <FlasherBootloaderPanel
          dark={dark}
          flashState={flashState}
          flashInfo={flashInfo}
          busyAction={busyAction}
          cmdResult={cmdResult}
          onDetectState={detectDeviceState}
          onRunAction={handleRunAction}
        />

        <FlasherImagePanel
          dark={dark}
          flashState={flashState}
          selectedPartition={selectedPartition}
          onSelectPartition={setSelectedPartition}
          flashFile={flashFile}
          onSelectFile={(f) => {
            setFlashFile(f);
            if (f) log(`Imagen cargada: ${f.name} (${(f.size / 1048576).toFixed(2)} MB)`);
          }}
          flashing={flashing}
          flashProgress={flashProgress}
          onExecuteFlash={handleExecuteFlash}
          onExecuteSideload={handleExecuteSideload}
        />
      </div>
    </ViewShell>
  );
}
