// ============================================================================
// ARCHIVO: useActions.ts
// QUÉ HACE: Hook centralizado de operaciones asíncronas sobre el dispositivo
//           (detección, apps, parcheo LSPatch, proyección, teclas y diagnóstico).
// CÓMO FUNCIONA: Conecta `useAppStore` con los helpers HTTP de `actionApi.ts`,
//           registra logs operativos y actualiza estado global de forma segura.
// POR QUÉ: Mantener una única fachada de acciones < 200 líneas (SRP) sin
//           duplicar lógica de red en cada vista.
// ============================================================================

'use client';
import { apiUrl } from '@/lib/api-url';

import { useRef, useCallback } from 'react';
import { useAppStore } from '@/stores';
import { postActionRequest, projectScreensBatch } from './actionApi';

export function useActions() {
  const activeSerial = useAppStore((s) => s.activeSerial);
  const deviceIP = useAppStore((s) => s.deviceIP);
  const devicesList = useAppStore((s) => s.devicesList);
  const screenBusy = useAppStore((s) => s.screenBusy);
  const isScreenStreaming = useAppStore((s) => s.isScreenStreaming);
  const videoSource = useAppStore((s) => s.videoSource);

  const addLog = useAppStore((s) => s.addLog);
  const setDevice = useAppStore((s) => s.setDevice);
  const setLoading = useAppStore((s) => s.setLoading);
  const setDeviceIP = useAppStore((s) => s.setDeviceIP);
  const setDevicesList = useAppStore((s) => s.setDevicesList);
  const setActiveSerial = useAppStore((s) => s.setActiveSerial);
  const setForegroundApp = useAppStore((s) => s.setForegroundApp);
  const setSecureAppsList = useAppStore((s) => s.setSecureAppsList);
  const setScreenStreaming = useAppStore((s) => s.setScreenStreaming);
  const setScreenBusy = useAppStore((s) => s.setScreenBusy);
  const setAppsList = useAppStore((s) => s.setAppsList);
  const setAppsLoading = useAppStore((s) => s.setAppsLoading);
  const setDiagnostics = useAppStore((s) => s.setDiagnostics);

  const wasScreenOpenRef = useRef(false);
  const screenReconnectAttemptRef = useRef(0);

  const fetchDevice = useCallback(async () => {
    setLoading(true);
    try {
      const query = activeSerial ? `?serial=${encodeURIComponent(activeSerial)}` : '';
      const response = await fetch(apiUrl(`/api/device${query}`), { cache: 'no-store' });
      const d = await response.json();
      if (useAppStore.getState().activeSerial !== activeSerial) return;
      if (!response.ok || !d.success) throw new Error(d.error || 'Error de detección');
      const device = d.activeDevice;
      setDevice(device || null); setDevicesList(d.devices);

      if (device) {
        if (device.serial && !activeSerial) setActiveSerial(device.serial);
        if (device.state !== 'device') addLog(`Dispositivo en estado: ${device.state}`);
        if (device.foregroundApp) setForegroundApp(device.foregroundApp);
        if (device.secureAppsList) setSecureAppsList(device.secureAppsList);
        if (device.ip) setDeviceIP(device.ip);
      }
    } catch {
      addLog('Error detectando dispositivo');
    } finally {
      setLoading(false);
    }
  }, [activeSerial, addLog, setLoading, setDevice, setActiveSerial, setForegroundApp, setSecureAppsList, setDeviceIP, setDevicesList]);

  const run = useCallback(async (
    action: string,
    desc: string,
    extraBody: Record<string, unknown> = {},
    logResult = true,
  ) => {
    if (action === 'open_screen') {
      wasScreenOpenRef.current = true;
      screenReconnectAttemptRef.current = 0;
    }
    if (logResult) addLog(`Ejecutando: ${desc}...`);
    try {
      const d = await postActionRequest(action, activeSerial, deviceIP, extraBody);
      if (logResult || (!d.success && ['input_text', 'keyevent'].includes(action))) addLog(d.success ? (d.message || desc) : `Error: ${d.error || action}`);
      if (!d.success && typeof d.error === 'string' && (d.error.includes('device offline') || d.error.includes('not found'))) {
        fetchDevice();
      }
      return d;
    } catch {
      addLog('Error de conexión');
      return { success: false, error: 'Error de conexión' };
    }
  }, [activeSerial, deviceIP, addLog, fetchDevice]);

  const fetchApps = async () => {
    const serial = activeSerial || useAppStore.getState().device?.serial;
    if (!serial || serial === 'Hardware Level') return;
    setAppsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/apps'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', serial }),
      });
      const d = await res.json();
      if (useAppStore.getState().activeSerial !== serial) return;
      if (d.success && d.apps) { setAppsList(d.apps); addLog(`${d.apps.length} aplicaciones analizadas`); }
      else addLog(`Error: ${d.error}`);
    } catch {
      if (useAppStore.getState().activeSerial === serial) addLog('Error al cargar aplicaciones');
    } finally {
      if (useAppStore.getState().activeSerial === serial) setAppsLoading(false);
    }
  };

  const toggleScreenStreaming = async () => {
    if (screenBusy) return;
    setScreenBusy(true);
    try {
      if (isScreenStreaming) {
        const result = await run('close_screen', 'Cerrando proyección', {});
        if (result.success) setScreenStreaming(false);
      }
      else {
        const r = await run('open_screen', 'Abriendo proyección', { videoSource }, false);
        if (r.success) { setScreenStreaming(true); addLog('Proyección iniciada'); }
        else addLog(`Error: ${r.error}`);
      }
    } finally { setScreenBusy(false); }
  };

  const projectAllScreens = async () => {
    if (devicesList.length < 2 || screenBusy) return;
    setScreenBusy(true);
    try {
      const results = await projectScreensBatch(devicesList, videoSource);
      const started = results.filter((r) => r.success).length;
      const failed = results.length - started;
      if (activeSerial && results.some((r) => r.serial === activeSerial && r.success)) {
        setScreenStreaming(true);
        wasScreenOpenRef.current = true;
      }
      addLog(failed === 0 ? `Proyección iniciada en ${started} dispositivo(s)` : `Proyección: ${started} ok, ${failed} fallaron`);
    } finally { setScreenBusy(false); }
  };

  const sendKey = async (key: string) => { await run('keyevent', `Tecla ${key}`, { keycode: key }, false); };
  const tapDevice = async (x: number, y: number) => { await run('input_tap', 'Tap', { x, y }, false); };
  const swipeDevice = async (x1: number, y1: number, x2: number, y2: number, duration = 120) => {
    await run('input_swipe', 'Gesto', { x1, y1, x2, y2, duration }, false);
  };

  const getDiagnostics = async () => {
    useAppStore.getState().setDiagLoading(true);
    try {
      const r = await run('get_diagnostics', 'Diagnóstico', {}, false);
      if (r.success && r.diagnostics) { setDiagnostics(r.diagnostics); addLog('Diagnóstico completo obtenido'); }
    } catch { addLog('Error de diagnóstico'); }
    finally { useAppStore.getState().setDiagLoading(false); }
  };

  return {
    run, fetchDevice, fetchApps, toggleScreenStreaming,
    projectAllScreens, sendKey, tapDevice, swipeDevice, getDiagnostics,
    wasScreenOpenRef, screenReconnectAttemptRef,
  };
}
