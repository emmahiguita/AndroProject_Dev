// ============================================================================
// ARCHIVO: useProjection.ts
// QUÉ HACE: Hook principal del estudio de proyección: gestiona el ciclo de vida
//           de VisionNano/AirPlay, grabación MP4, auto-proyección, pantalla
//           completa y conexión ADB Wi-Fi.
// CÓMO FUNCIONA: Realiza polling de `check_screen` respetando Visibility API,
//           sincroniza `check_record` al cambiar de dispositivo y valida
//           `res?.success` antes de actualizar estados de transmisión/grabación.
// POR QUÉ: Evitar falsos positivos cuando el backend falla y delegar acciones
//           atómicas a `useProjectionActions` mantiene el hook bajo 200 líneas.
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useActions } from './useActions';
import { useProjectionActions } from './useProjectionActions';
import type { DeviceInfo } from '@/features/types';
import {
  DEFAULT_SCRCPY_OPTIONS,
  type RecordActionResult,
  type ScrcpyOptions,
  type UseProjectionReturn,
} from './useProjectionTypes';

export type { ScrcpyOptions, UseProjectionReturn };

const STATUS_POLL_MS = 5000;

export function useProjection(device: DeviceInfo | null | undefined): UseProjectionReturn {
  const { run } = useActions();
  const [scrcpyActive, setScrcpyActive] = useState(false);
  const [scrcpyOptions, setScrcpyOptions] = useState<ScrcpyOptions>(DEFAULT_SCRCPY_OPTIONS);
  const [fullscreen, setFullscreen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [autoProject, setAutoProject] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [lastRecordedPath, setLastRecordedPath] = useState<string | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStartingRef = useRef(false);
  const prevDeviceSerialRef = useRef<string | undefined>(undefined);

  const serial = device?.serial ?? undefined;
  const isIos = Boolean(device?.platform === 'ios' || serial?.startsWith('airplay-') || serial?.startsWith('apple-'));

  const stopRecordTimer = useCallback(() => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
  }, []);

  const startRecordTimer = useCallback((initialSeconds = 0) => {
    stopRecordTimer();
    setRecordingSeconds(initialSeconds);
    recordTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
  }, [stopRecordTimer]);

  // Polling de estado de proyección con Page Visibility API
  useEffect(() => {
    if (!serial) return;
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const checkAlive = () => {
      if (document.visibilityState === 'hidden') return;
      run('check_screen', '', { serial }, false).then((res: any) => { if (isMounted) setScrcpyActive(Boolean(res?.alive)); }).catch(() => {});
    };
    const startInterval = () => { if (!intervalId) { checkAlive(); intervalId = setInterval(checkAlive, STATUS_POLL_MS); } };
    const stopInterval = () => { if (intervalId) { clearInterval(intervalId); intervalId = null; } };
    const onVisibilityChange = () => (document.visibilityState === 'visible' ? startInterval() : stopInterval());

    startInterval();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { isMounted = false; stopInterval(); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, [serial, run]);

  // Sincroniza estado de grabación activa al montar o cambiar de dispositivo
  useEffect(() => {
    stopRecordTimer(); setIsRecording(false); setRecordingSeconds(0);
    if (!serial || isIos) return;
    let isMounted = true;
    const sync = async () => {
      const res = await run('check_record', '', { serial }, false);
      if (!isMounted || typeof res?.recording !== 'boolean') return;
      setIsRecording(res.recording);
      if (res.recording && !recordTimerRef.current) startRecordTimer(Math.max(0, Math.floor((Date.now() - res.startedAt) / 1000)));
      if (!res.recording) { stopRecordTimer(); setRecordingSeconds(0); }
      if (res.recordPath) setLastRecordedPath(res.recordPath);
    };
    void sync();
    const timer = setInterval(sync, STATUS_POLL_MS);
    return () => { isMounted = false; clearInterval(timer); stopRecordTimer(); };
  }, [serial, isIos, run, startRecordTimer, stopRecordTimer]);

  // Auto-proyección cuando aparece un nuevo dispositivo
  useEffect(() => {
    if (!autoProject || !serial || scrcpyActive || autoStartingRef.current || isBusy) return;
    if (prevDeviceSerialRef.current === serial) return;
    prevDeviceSerialRef.current = serial;
    autoStartingRef.current = true;
    run('open_screen', 'Auto-proyección detectada...', { serial, ...scrcpyOptions })
      .then((res: any) => { if (res?.success) setScrcpyActive(true); })
      .catch(() => {})
      .finally(() => { autoStartingRef.current = false; });
  }, [autoProject, serial, scrcpyActive, isBusy, scrcpyOptions, run]);

  useEffect(() => () => stopRecordTimer(), [stopRecordTimer]);

  const connectAdb = useCallback(async (ip: string, port?: string) => {
    const target = `${ip.trim()}:${(port || '5555').trim()}`;
    setIsConnecting(true);
    try {
      const data = await run('connect_adb', `Conectando a ${target}`, { target }, false);
      return { success: Boolean(data?.success), message: data?.message || data?.error };
    } catch { return { success: false, message: 'Error de conexión de red' }; }
    finally { setIsConnecting(false); }
  }, [run]);

  const toggleScrcpy = useCallback(async (customOpts?: Partial<ScrcpyOptions>) => {
    if (!serial) return;
    setIsBusy(true);
    try {
      if (scrcpyActive) {
        const res = await run('stop_screen', 'Deteniendo scrcpy', { serial });
        if (res?.success) setScrcpyActive(false);
      } else {
        const res = await run('open_screen', 'Iniciando AndroProject nativo 60 FPS...', { serial, ...scrcpyOptions, ...customOpts });
        if (res?.success) setScrcpyActive(true);
      }
    } finally { setIsBusy(false); }
  }, [scrcpyActive, scrcpyOptions, serial, run]);

  const toggleRecord = useCallback(async (): Promise<RecordActionResult> => {
    if (!serial) return { success: false, recording: false, message: 'Sin dispositivo conectado' };
    if (isIos) return { success: false, recording: false, message: 'Grabación scrcpy disponible para Android (ADB)' };
    setIsBusy(true);
    try {
      if (isRecording) {
        const res = await run('stop_record', 'Deteniendo grabación...', { serial });
        if (res?.recording === false) { setIsRecording(false); stopRecordTimer(); setRecordingSeconds(0); }
        const saved = typeof res?.recordPath === 'string' ? res.recordPath : null;
        if (saved) setLastRecordedPath(saved);
        return {
          success: Boolean(res?.success),
          recording: res?.recording !== false,
          message: res?.error || res?.message || (saved ? `Grabación guardada: ${saved}` : 'Grabación detenida'),
          recordPath: saved,
        };
      }
      const res = await run('start_record', 'Iniciando grabación HD silenciosa...', {
        serial,
        videoSource: scrcpyOptions.videoSource,
        bitRate: scrcpyOptions.bitRate,
        maxFps: scrcpyOptions.maxFps,
      });
      if (res?.success) {
        setIsRecording(true);
        startRecordTimer(0);
        return {
          success: true,
          recording: true,
          message: res.message || 'Grabación MP4 en curso',
          recordPath: res.recordPath ?? null,
        };
      }
      return {
        success: false,
        recording: false,
        message: res?.error || 'No se pudo iniciar la grabación',
      };
    } finally {
      setIsBusy(false);
    }
  }, [isRecording, isIos, scrcpyOptions.videoSource, scrcpyOptions.bitRate, scrcpyOptions.maxFps, serial, run, startRecordTimer, stopRecordTimer]);

  const toggleFullscreen = useCallback(async () => {
    const enter = !document.fullscreenElement;
    await (enter ? document.documentElement.requestFullscreen() : document.exitFullscreen()).catch(() => {});
    setFullscreen(enter);
  }, []);

  const actions = useProjectionActions(serial, isIos, run);

  return {
    scrcpyActive, toggleScrcpy, scrcpyOptions, setScrcpyOptions,
    fullscreen, toggleFullscreen, isRecording, recordingSeconds, lastRecordedPath, toggleRecord,
    isBusy, connectAdb, isConnecting, autoProject, setAutoProject,
    ...actions,
  };
}
