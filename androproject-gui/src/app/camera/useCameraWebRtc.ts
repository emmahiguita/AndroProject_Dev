// ============================================================================
// ARCHIVO: useCameraWebRtc.ts
// QUÉ HACE: Hook completo de ciclo de vida para cámara (trasera/frontal/webcam),
//           enlace automático de `<video>` al montar, WebRTC con reconexión,
//           captura PNG y grabación WebM.
// CÓMO FUNCIONA: Sincroniza `videoRef.current.srcObject = stream` en `useEffect`
//           tras el montaje condicional del `<video>`, evitando pantalla negra.
// POR QUÉ: Corregir la vista local negra y soportar cambio de cámara (< 200L).
// ============================================================================
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  INITIAL_METRICS, getCameraErrorMessage, type CameraMetrics,
} from './cameraTypes';
import { attachPeerHandlers, createConfiguredPeer, negotiateSdpOffer, readPeerMetrics } from './cameraRtcHelpers';
import { captureVideoSnapshot, disposeCameraResources, listVideoInputs, requestCameraStream, resetCameraZoom, startWebmRecording } from './cameraMediaHelpers';
import { useVisionHealth } from './useVisionHealth';

const MAX_RECONNECT_ATTEMPTS = 5;

export function useCameraWebRtc() {
  const { serverUrl, setServerUrl, backendHealth, refreshHealth } = useVisionHealth();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [metrics, setMetrics] = useState<CameraMetrics>(INITIAL_METRICS);

  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBytesRef = useRef(0);
  const lastStatsTimeRef = useRef(0);
  const iceFailCountRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectFnRef = useRef<() => void>(() => {});

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (el && stream) { el.srcObject = stream; el.muted = true; void el.play().catch(() => {}); }
  }, [stream]);

  const refsBundle = useCallback(() => ({
    statsIntervalRef, reconnectTimerRef, iceRetryTimerRef,
    mediaRecorderRef, recordedChunksRef, pcRef, streamRef, remoteStreamRef,
  }), []);

  useEffect(() => () => { disposeCameraResources(refsBundle()); }, [refsBundle]);

  const resetMetrics = useCallback(() => {
    setMetrics(INITIAL_METRICS);
    if (statsIntervalRef.current) { clearInterval(statsIntervalRef.current); statsIntervalRef.current = null; }
  }, []);

  const startStatsCollection = useCallback(() => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(async () => {
      if (!pcRef.current) return;
      try {
        const res = await readPeerMetrics(pcRef.current, lastBytesRef.current, lastStatsTimeRef.current);
        if (!res?.metrics) return;
        lastBytesRef.current = res.bytes; lastStatsTimeRef.current = res.time;
        setMetrics((prev) => ({ ...prev, ...res.metrics }));
      } catch {}
    }, 3000);
  }, []);

  const startCamera = useCallback(async (overrideFacing?: 'environment' | 'user', overrideId?: string): Promise<MediaStream | null> => {
    try {
      const targetFacing = overrideFacing ?? facingMode;
      const targetId = overrideId ?? selectedDeviceId;
      addLog(`Iniciando cámara (${targetId ? 'dispositivo' : targetFacing})...`);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const mediaStream = await requestCameraStream(targetFacing, targetId || undefined);
      await resetCameraZoom(mediaStream);
      streamRef.current = mediaStream; setStream(mediaStream);
      setCameras(await listVideoInputs());
      mediaStream.getTracks().forEach((t) => {
        t.onended = () => { if (streamRef.current === mediaStream && !mediaStream.getTracks().some((x) => x.readyState === 'live')) { streamRef.current = null; setStream(null); setActive(false); } };
      });
      const vs = mediaStream.getVideoTracks()[0]?.getSettings();
      const as = mediaStream.getAudioTracks()[0]?.getSettings();
      addLog(`Cámara lista: ${vs?.width ?? '?'}×${vs?.height ?? '?'} @ ${Math.round(vs?.frameRate ?? 0)} FPS${as ? ` · Audio ${as.sampleRate ?? '?'}Hz` : ' · Sin audio'}`);
      iceFailCountRef.current = 0; reconnectAttemptRef.current = 0;
      return mediaStream;
    } catch (error: unknown) { addLog(`Error cámara: ${getCameraErrorMessage(error)}`); return null; }
  }, [addLog, facingMode, selectedDeviceId]);

  const switchCamera = useCallback(async (nextDeviceId?: string) => {
    if (nextDeviceId !== undefined) {
      setSelectedDeviceId(nextDeviceId);
      if (streamRef.current) await startCamera(facingMode, nextDeviceId);
      return;
    }
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next); setSelectedDeviceId('');
    if (streamRef.current) await startCamera(next, '');
  }, [facingMode, startCamera]);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    mediaRecorderRef.current = null; setIsRecording(false);
  }, []);

  const stopCamera = useCallback(() => {
    setReconnecting(false); reconnectAttemptRef.current = 0; setIsRecording(false);
    disposeCameraResources(refsBundle());
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setActive(false); resetMetrics(); lastBytesRef.current = 0; lastStatsTimeRef.current = 0; iceFailCountRef.current = 0;
    addLog('Transmisión y cámara detenidas.');
  }, [addLog, refsBundle, resetMetrics]);

  const startRecording = useCallback(() => {
    const remote = remoteStreamRef.current;
    const hasRemote = Boolean(remote && remote.getVideoTracks().some((t) => t.readyState === 'live'));
    const target = hasRemote ? remote : streamRef.current;
    if (!target || target.getVideoTracks().length === 0) { addLog('Inicia la cámara antes de grabar.'); return; }
    try { startWebmRecording(target, mediaRecorderRef, recordedChunksRef, setIsRecording, addLog); addLog(hasRemote ? 'Grabando retorno (WebM)...' : 'Grabando cámara local (WebM)...'); }
    catch (e: unknown) { addLog(`No se pudo iniciar la grabación: ${getCameraErrorMessage(e)}`); }
  }, [addLog]);

  const takeSnapshot = useCallback(() => {
    try { captureVideoSnapshot(active && remoteVideoRef.current?.videoWidth ? remoteVideoRef.current : videoRef.current); addLog('Captura PNG guardada.'); }
    catch (e: unknown) { addLog(`Error al capturar foto: ${getCameraErrorMessage(e)}`); }
  }, [active, addLog]);

  const establishConnection = useCallback(async () => {
    const localStream = streamRef.current;
    if (!localStream || localStream.getTracks().every((t) => t.readyState === 'ended')) throw new Error('La cámara no tiene un stream activo.');
    let endpoint: URL;
    try { endpoint = new URL(serverUrl); } catch { throw new Error('La dirección del servidor no es válida.'); }
    if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('El servidor debe usar HTTP o HTTPS.');
    addLog(`Conectando con ${endpoint.host}...`);
    if (pcRef.current) { pcRef.current.ontrack = null; pcRef.current.oniceconnectionstatechange = null; pcRef.current.close(); }
    const pc = createConfiguredPeer(localStream);
    pcRef.current = pc;
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    attachPeerHandlers({ pc, remoteStream, remoteStreamRef, remoteVideoRef, pcRef, iceFailCountRef, reconnectAttemptRef, iceRetryTimerRef, reconnectFnRef, setActive, setReconnecting, addLog, startStatsCollection, resetMetrics });
    await negotiateSdpOffer(pc, endpoint);
    addLog('Negociación WebRTC completada.');
  }, [addLog, resetMetrics, serverUrl, startStatsCollection]);

  const attemptFullReconnection = useCallback(() => {
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) { addLog(`Límite de ${MAX_RECONNECT_ATTEMPTS} reconexiones alcanzado.`); stopCamera(); return; }
    reconnectAttemptRef.current += 1;
    const delay = Math.min(1000 * 2 ** (reconnectAttemptRef.current - 1), 30000);
    setReconnecting(true); addLog(`Reconectando en ${delay / 1000} s (${reconnectAttemptRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(async () => {
      try {
        let cur = streamRef.current;
        if (!cur || cur.getTracks().every((t) => t.readyState === 'ended')) cur = await startCamera();
        if (!cur || cur.getTracks().every((t) => t.readyState === 'ended')) throw new Error('No se pudo recuperar el stream.');
        await establishConnection();
      } catch (error: unknown) { addLog(`Reconexión fallida: ${getCameraErrorMessage(error)}`); reconnectFnRef.current(); }
    }, delay);
  }, [addLog, establishConnection, startCamera, stopCamera]);

  useEffect(() => { reconnectFnRef.current = attemptFullReconnection; return () => { reconnectFnRef.current = () => {}; }; }, [attemptFullReconnection]);

  const startStream = useCallback(async () => {
    if (!streamRef.current) { addLog('Inicia la cámara primero.'); return; }
    const health = await refreshHealth();
    if (!health.online) addLog('Aviso: Vision Backend (:8000) no respondió a /health, intentando SDP...');
    setReconnecting(false); reconnectAttemptRef.current = 0;
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    try { await establishConnection(); } catch (error: unknown) {
      setActive(false); addLog(`No se pudo conectar: ${getCameraErrorMessage(error)}`);
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    }
  }, [addLog, establishConnection, refreshHealth]);

  return {
    stream, active, serverUrl, setServerUrl, facingMode, cameras, selectedDeviceId, backendHealth,
    logs, reconnecting, isRecording, metrics, videoRef, remoteVideoRef,
    startCamera: () => startCamera(), stopCamera, switchCamera, startStream, startRecording, stopRecording, takeSnapshot, refreshHealth,
  };
}
