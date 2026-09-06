// ── useActions — centralized async operations ────────────────────
// Encapsulates all API calls and side effects. Views import this hook
// instead of receiving action functions as props.
// Follows Single Responsibility: one hook = one concern (actions).

'use client';

import { useRef, useCallback } from 'react';
import { useAppStore } from '@/stores';

export function useActions() {
  const activeSerial = useAppStore((s) => s.activeSerial);
  const deviceIP = useAppStore((s) => s.deviceIP);
  const videoSource = useAppStore((s) => s.videoSource);
  const devicesList = useAppStore((s) => s.devicesList);
  const screenBusy = useAppStore((s) => s.screenBusy);
  const isScreenStreaming = useAppStore((s) => s.isScreenStreaming);
  const isRecording = useAppStore((s) => s.isRecording);

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
  const setRecording = useAppStore((s) => s.setRecording);
  const setRecordingElapsed = useAppStore((s) => s.setRecordingElapsed);
  const setRecordingPath = useAppStore((s) => s.setRecordingPath);
  const setConfigData = useAppStore((s) => s.setConfigData);
  const setAppsList = useAppStore((s) => s.setAppsList);
  const setAppsLoading = useAppStore((s) => s.setAppsLoading);
  const setDiagnostics = useAppStore((s) => s.setDiagnostics);

  // Refs for screen reconnection (migrated from page.tsx)
  const wasScreenOpenRef = useRef(false);
  const screenReconnectAttemptRef = useRef(0);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSecondsRef = useRef(0);

  // ── Core action runner ─────────────────────────────────────────
  const run = useCallback(async (
    action: string,
    desc: string,
    extraBody: Record<string, unknown> = {},
    logResult: boolean = true,
  ) => {
    if (action === 'open_screen') {
      wasScreenOpenRef.current = true;
      screenReconnectAttemptRef.current = 0;
    }
    if (logResult) addLog(`Ejecutando: ${desc}...`);
    try {
      // FIX BUG#7: extraer IP de cualquier puerto (mDNS usa puertos dinamicos como :33085)
      const dIP = activeSerial?.includes(':') 
        ? activeSerial.split(':')[0]
        : deviceIP;
      const r = await fetch('/api/actions', {
        method: 'POST',
        body: JSON.stringify({ action, ip: dIP, serial: activeSerial, ...extraBody }),
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await r.json();
      if (logResult) addLog(d.success ? `${d.message}` : `Error: ${d.error}`);
      if (!d.success && d.error && (typeof d.error === 'string') &&
          (d.error.includes('device offline') || d.error.includes('not found'))) {
        fetchDevice();
      }
      return d;
    } catch {
      if (logResult) addLog('Error de conexión');
      return { success: false, error: 'Error de conexión' };
    }
  }, [activeSerial, deviceIP, addLog]);

  // ── Device detection ───────────────────────────────────────────
  const fetchDevice = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'detect' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await r.json();
      if (d.success && d.device) {
        setDevice(d.device);
        if (d.device.serial && !activeSerial) setActiveSerial(d.device.serial);
        if (d.device.state !== 'device') addLog(`Dispositivo en estado: ${d.device.state}`);
        if (d.device.foregroundApp) setForegroundApp(d.device.foregroundApp);
        if (d.device.secureAppsList) setSecureAppsList(d.device.secureAppsList);
        if (d.device.ip) setDeviceIP(d.device.ip);
        if (d.devices) setDevicesList(d.devices);
        if (d.config) setConfigData(d.config);
      }
    } catch {
      addLog('Error detectando dispositivo');
    } finally {
      setLoading(false);
    }
  };

  // ── App management ─────────────────────────────────────────────
  const fetchApps = async () => {
    setAppsLoading(true);
    try {
      const r = await fetch('/api/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'list_apps', serial: activeSerial }),
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await r.json();
      if (d.success) {
        setAppsList(d.apps || []);
        addLog(`${(d.apps || []).length} aplicaciones cargadas`);
      } else {
        addLog(`Error: ${d.error}`);
      }
    } catch {
      addLog('Error al cargar aplicaciones');
    } finally {
      setAppsLoading(false);
    }
  };

  // ── App patching ───────────────────────────────────────────────
  const startPatching = async (
    targetPackage: string,
    _setIsPatching: (v: boolean) => void,
    _setPatchLogs: (l: string) => void,
  ) => {
    // FIX BUG#8: leer estado del store directamente sin violar reglas de Hooks
    const state = useAppStore.getState();
    const pkg = targetPackage || state.patchPackage;
    const isClone = state.isCloneMode;
    if (!pkg) {
      _setPatchLogs('Ingresa un nombre de paquete válido');
      return;
    }
    _setIsPatching(true);
    _setPatchLogs(`Analizando ${pkg}...`);
    addLog(`Iniciando parcheo de ${pkg}...`);
    try {
      const res = await fetch('/api/patch-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'patch_app',
          packageName: pkg,
          serial: activeSerial,
          isClone,
        }),
      });
      const d = await res.json();
      if (d.success) {
        _setPatchLogs(`${d.message || 'Proceso completado exitosamente'}`);
        addLog(`Aplicación curada: ${pkg}`);
      } else {
        _setPatchLogs(`Error: ${d.error || 'Error en el proceso de curado'}`);
        addLog(`Error parcheando ${pkg}: ${d.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      _setPatchLogs(`Error de conexión: ${msg}`);
      addLog(`Error de conexión al parchear ${pkg}`);
    } finally {
      _setIsPatching(false);
    }
  };

  // ── Screen streaming ───────────────────────────────────────────
  const toggleScreenStreaming = async () => {
    if (screenBusy) return;
    setScreenBusy(true);
    try {
      if (isScreenStreaming) {
        await run('close_screen', 'Cerrando proyección', {});
        setScreenStreaming(false);
      } else {
        const r = await run('open_screen', 'Abriendo proyección', { videoSource }, false);
        if (r.success) { setScreenStreaming(true); addLog('Proyección iniciada'); }
        else { addLog(`Error: ${r.error}`); }
      }
    } finally {
      setScreenBusy(false);
    }
  };

  const projectAllScreens = async () => {
    if (devicesList.length < 2 || screenBusy) return;
    setScreenBusy(true);
    try {
      const results = await Promise.all(devicesList.map(async ({ serial }) => {
        try {
          const response = await fetch('/api/actions', {
            method: 'POST',
            body: JSON.stringify({ action: 'open_screen', serial, videoSource }),
            headers: { 'Content-Type': 'application/json' },
          });
          const data = await response.json();
          return { serial, success: Boolean(data.success), error: data.error as string | undefined };
        } catch {
          return { serial, success: false, error: 'Error de conexión' };
        }
      }));
      const started = results.filter(r => r.success).length;
      const failed = results.length - started;
      if (activeSerial && results.some(r => r.serial === activeSerial && r.success)) {
        setScreenStreaming(true);
        wasScreenOpenRef.current = true;
      }
      addLog(failed === 0
        ? `Proyección iniciada en ${started} dispositivo(s)`
        : `Proyección: ${started} ok, ${failed} fallaron`);
    } finally {
      setScreenBusy(false);
    }
  };

  // ── Recording ──────────────────────────────────────────────────
  const toggleRecord = async () => {
    if (isRecording) {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
      setRecording(false);
      setRecordingElapsed('00:00');
      recordingSecondsRef.current = 0;
      await run('stop_record', 'Detener grabación');
    } else {
      const r = await run('start_record', 'Iniciar grabación', { source: videoSource }, false);
      if (r.success) {
        setRecording(true);
        setRecordingPath(r.path || null);
        recordingSecondsRef.current = 0;
        recordingIntervalRef.current = setInterval(() => {
          recordingSecondsRef.current += 1;
          const m = Math.floor(recordingSecondsRef.current / 60).toString().padStart(2, '0');
          const s = (recordingSecondsRef.current % 60).toString().padStart(2, '0');
          setRecordingElapsed(`${m}:${s}`);
        }, 1000);
        addLog('Grabación iniciada');
      } else {
        addLog(`Error al grabar: ${r.error || ''}`);
      }
    }
  };

  // ── Key injection (ADB) ────────────────────────────────────────
  const sendKey = async (key: string) => {
    await run('keyevent', `Tecla ${key}`, { keycode: key }, false);
  };

  // ── Touch injection (ADB) — silencioso: los gestos no deben inundar el log ──
  const tapDevice = async (x: number, y: number) => {
    await run('input_tap', 'Tap', { x, y }, false);
  };

  const swipeDevice = async (
    x1: number, y1: number, x2: number, y2: number, duration: number = 120,
  ) => {
    await run('input_swipe', 'Gesto', { x1, y1, x2, y2, duration }, false);
  };

  // ── Diagnostics ────────────────────────────────────────────────
  const getDiagnostics = async () => {
    useAppStore.getState().setDiagLoading(true);
    try {
      const r = await run('get_diagnostics', 'Diagnóstico', {}, false);
      if (r.success && r.diagnostics) {
        setDiagnostics(r.diagnostics);
        addLog('Diagnóstico completo obtenido');
      }
    } catch {
      addLog('Error de diagnóstico');
    } finally {
      useAppStore.getState().setDiagLoading(false);
    }
  };

  // ── Exposed API ────────────────────────────────────────────────
  return {
    run,
    fetchDevice,
    fetchApps,
    startPatching,
    toggleScreenStreaming,
    projectAllScreens,
    toggleRecord,
    sendKey,
    tapDevice,
    swipeDevice,
    getDiagnostics,
    // Refs exposed for cleanup (used by useEffect in page.tsx)
    wasScreenOpenRef,
    screenReconnectAttemptRef,
  };
}
