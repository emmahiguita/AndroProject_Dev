// ============================================================================
// ARCHIVO: FlasherView.tsx
// QUÉ HACE: Orquestador del módulo Flasheador (Bootloader, Particiones A/B,
//           Estado Root, Fastboot .img, Boot temporal en RAM y ADB Sideload).
// CÓMO FUNCIONA: Al montar o cambiar de dispositivo (`targetSerial`), consulta
//           `/api/flash` (`check_state`) para leer modo real y propiedades del
//           bootloader (`ro.boot.*` o `fastboot getvar`), y ejecuta flasheos.
// POR QUÉ: Conectar `device` prop, `fastboot_boot` y `--disable-verity` (< 200L).
// ============================================================================
'use client';
import { apiUrl } from '@/lib/api-url';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { PARTITIONS } from './flasher/flasher-partitions';
import { FlasherBootloaderPanel } from './flasher/FlasherBootloaderPanel';
import { FlasherImagePanel } from './flasher/FlasherImagePanel';
import { FlasherLiveMonitor } from './flasher/FlasherLiveMonitor';
import type { DeviceInfo } from './types';

interface FlasherViewProps {
  device?: DeviceInfo | null;
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function FlasherView({ device: propDevice, addLog: propAddLog }: FlasherViewProps = {}) {
  const { dark } = useTheme();
  const s = useAppStore();
  const targetSerial = s.activeSerial || propDevice?.serial || s.device?.serial || null;
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [disableVerity, setDisableVerity] = useState(false);
  const [cmdResult, setCmdResult] = useState<{ text: string; isError: boolean } | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); }, []);

  const log = useCallback(
    (msg: string, type: 'info' | 'success' | 'error' = 'info') => (propAddLog ? propAddLog(msg, type) : s.addLog(msg)),
    [propAddLog, s],
  );

  const detectDeviceState = useCallback(async () => {
    setBusyAction('check_state');
    try {
      const fd = new FormData();
      fd.append('action', 'check_state');
      if (targetSerial) fd.append('serial', targetSerial);
      const r = await fetch(apiUrl('/api/flash'), { method: 'POST', body: fd });
      const d = await r.json();
      s.setFlashState(d.state || 'unknown');
      s.setFlashInfo(d.deviceInfo || {});
      log(`Estado Flasheador: ${d.state || 'unknown'} (${d.deviceInfo?.product || targetSerial || '--'})`);
    } catch { log('Error al consultar estado de Fastboot/ADB', 'error'); }
    finally { setBusyAction(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSerial]);

  useEffect(() => { void Promise.resolve().then(detectDeviceState); }, [detectDeviceState]);

  const handleRunAction = async (action: string, confirmMsg?: string, extra?: Record<string, string>) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusyAction(action);
    setCmdResult(null);
    try {
      const fd = new FormData();
      fd.append('action', action);
      if (targetSerial) fd.append('serial', targetSerial);
      if (extra) for (const [k, v] of Object.entries(extra)) fd.append(k, v);
      const r = await fetch(apiUrl('/api/flash'), { method: 'POST', body: fd });
      const d = await r.json();
      const msg = d.message || d.info || d.error || 'Comando procesado.';
      setCmdResult({ text: msg, isError: !d.success });
      log(msg, d.success ? 'success' : 'error');
      if (action.startsWith('reboot_') || action.startsWith('fastboot_')) {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(detectDeviceState, 2200);
      }
    } catch { setCmdResult({ text: 'Error de comunicación con /api/flash.', isError: true }); }
    finally { setBusyAction(null); }
  };

  const handleExecuteFlash = async () => {
    if (!s.flashFile) return;
    const partObj = PARTITIONS.find((p) => p.id === s.selectedPartition);
    const isCritical = partObj?.critical === true;
    if (!confirm(`¿Flashear "${s.flashFile.name}" en la partición "${s.selectedPartition}"?`)) return;
    if (isCritical && !confirm(`ADVERTENCIA CRÍTICA: "${s.selectedPartition}" es una partición de bajo nivel. ¿Confirmas continuar?`)) return;

    s.setFlashing(true);
    s.setFlashProgress(`Flasheando ${s.selectedPartition}...`);
    setCmdResult(null);
    try {
      const fd = new FormData();
      fd.append('action', 'flash');
      fd.append('file', s.flashFile);
      fd.append('partition', s.selectedPartition);
      if (isCritical) fd.append('confirmCritical', 'true');
      if (disableVerity && s.selectedPartition.startsWith('vbmeta')) fd.append('disableVerity', 'true');
      if (targetSerial) fd.append('serial', targetSerial);
      const r = await fetch(apiUrl('/api/flash-image'), { method: 'POST', body: fd });
      const d = await r.json();
      const msg = d.message || d.error || 'Operación finalizada.';
      setCmdResult({ text: msg, isError: !d.success });
      s.setFlashProgress(d.success ? 'Completado' : 'Error');
      log(msg, d.success ? 'success' : 'error');
    } catch { setCmdResult({ text: 'Error de red durante el flasheo.', isError: true }); }
    finally { s.setFlashing(false); }
  };

  const handleExecuteBootTemp = async () => {
    if (!s.flashFile) return;
    if (!confirm(`¿Arrancar temporalmente "${s.flashFile.name}" en RAM (fastboot boot) sin flashear la partición?`)) return;
    s.setFlashing(true);
    s.setFlashProgress('Arrancando imagen en RAM...');
    setCmdResult(null);
    try {
      const fd = new FormData();
      fd.append('action', 'fastboot_boot');
      fd.append('file', s.flashFile);
      if (targetSerial) fd.append('serial', targetSerial);
      const r = await fetch(apiUrl('/api/flash-image'), { method: 'POST', body: fd });
      const d = await r.json();
      const msg = d.message || d.error || 'Boot temporal enviado.';
      setCmdResult({ text: msg, isError: !d.success });
      log(msg, d.success ? 'success' : 'error');
    } catch { setCmdResult({ text: 'Error de red durante fastboot boot.', isError: true }); }
    finally { s.setFlashing(false); }
  };

  const handleExecuteSideload = async (file: File) => {
    if (!confirm(`¿Enviar "${file.name}" vía ADB Sideload?`)) return;
    s.setFlashing(true);
    s.setFlashProgress('Enviando ZIP por sideload...');
    setCmdResult(null);
    try {
      const fd = new FormData();
      fd.append('action', 'sideload');
      fd.append('file', file);
      if (targetSerial) fd.append('serial', targetSerial);
      const r = await fetch(apiUrl('/api/flash-image'), { method: 'POST', body: fd });
      const d = await r.json();
      const msg = d.message || d.error || 'Sideload finalizado.';
      setCmdResult({ text: msg, isError: !d.success });
      log(msg, d.success ? 'success' : 'error');
    } catch { setCmdResult({ text: 'Error de conexión durante ADB Sideload.', isError: true }); }
    finally { s.setFlashing(false); }
  };

  return (
    <ViewShell navId="flasher">
      <div className="mx-auto w-full max-w-4xl space-y-3">
        <FlasherBootloaderPanel
          dark={dark} flashState={s.flashState} flashInfo={s.flashInfo}
          busyAction={busyAction} cmdResult={cmdResult}
          onDetectState={detectDeviceState} onRunAction={handleRunAction}
        />

        <FlasherLiveMonitor
          dark={dark} serial={targetSerial} flashState={s.flashState}
          flashInfo={s.flashInfo as Record<string, unknown>} onLog={log}
        />

        <FlasherImagePanel
          dark={dark} flashState={s.flashState} selectedPartition={s.selectedPartition}
          onSelectPartition={s.setSelectedPartition} flashFile={s.flashFile}
          onSelectFile={(f) => { s.setFlashFile(f); if (f) log(`Imagen cargada: ${f.name} (${(f.size / 1048576).toFixed(2)} MB)`); }}
          flashing={s.flashing} flashProgress={s.flashProgress}
          disableVerity={disableVerity} onToggleDisableVerity={setDisableVerity}
          onExecuteFlash={handleExecuteFlash} onExecuteBootTemp={handleExecuteBootTemp}
          onExecuteSideload={handleExecuteSideload}
        />
      </div>
    </ViewShell>
  );
}
