// ============================================================================
// ARCHIVO: useCameraWebRtc.ts
// QUÉ HACE: Hook de ciclo de vida para cámara trasera, WebRTC, reconexión
//           exponencial y grabación WebM en `/camera`.
// CÓMO FUNCIONA: Orquesta estado de UI y delega captura/grabación/limpieza a
//           `cameraMediaHelpers.ts` y señalización/ICE/métricas a `cameraRtcHelpers.ts`.
// POR QUÉ: Mantener el hook bajo 200 líneas (SRP) y libre de memory leaks.
// ============================================================================

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { INITIAL_METRICS, getCameraErrorMessage, type CameraMetrics } from './cameraTypes';
import { attachPeerHandlers, createConfiguredPeer, negotiateSdpOffer, readPeerMetrics } from './cameraRtcHelpers';
import { disposeCameraResources, requestBackCameraStream, startWebmRecording } from './cameraMediaHelpers';

const DEFAULT_SERVER_URL = 'http://127.0.0.1:8000/vision/offer';
const MAX_RECONNECT_ATTEMPTS = 5;

export function useCameraWebRtc() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
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
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return;
    const t = setTimeout(() => setServerUrl(`http://${h}:8000/vision/offer`), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => () => {
    disposeCameraResources({
      statsIntervalRef, reconnectTimerRef, iceRetryTimerRef,
      mediaRecorderRef, recordedChunksRef, pcRef, streamRef, remoteStreamRef,
    });
  }, []);

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
        lastBytesRef.current = res.bytes;
        lastStatsTimeRef.current = res.time;
        setMetrics((prev) => ({ ...prev, ...res.metrics }));
      } catch {}
    }, 3000);
  }, []);

  const startCamera = useCallback(async (): Promise<MediaStream | null> => {
    try {
      addLog('Solicitando acceso a la cámara trasera con audio...');
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const mediaStream = await requestBackCameraStream();
      streamRef.current = mediaStream; setStream(mediaStream);
      if (videoRef.current) { videoRef.current.srcObject = mediaStream; videoRef.current.muted = true; }
      mediaStream.getTracks().forEach((track) => {
        track.onended = () => {
          if (streamRef.current === mediaStream && !mediaStream.getTracks().some((t) => t.readyState === 'live')) {
            streamRef.current = null; setStream(null); setActive(false);
          }
        };
      });
      const vs = mediaStream.getVideoTracks()[0]?.getSettings();
      const as = mediaStream.getAudioTracks()[0]?.getSettings();
      addLog(`Cámara ${vs?.width ?? '?'}×${vs?.height ?? '?'} a ${vs?.frameRate ?? '?'} FPS · Audio ${as?.sampleRate ?? '?'} Hz`);
      iceFailCountRef.current = 0; reconnectAttemptRef.current = 0;
      return mediaStream;
    } catch (error: unknown) {
      addLog(`No se pudo iniciar la cámara: ${getCameraErrorMessage(error)}`);
      return null;
    }
  }, [addLog]);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    mediaRecorderRef.current = null; setIsRecording(false);
  }, []);

  const stopCamera = useCallback(() => {
    setReconnecting(false); reconnectAttemptRef.current = 0; setIsRecording(false);
    disposeCameraResources({
      statsIntervalRef, reconnectTimerRef, iceRetryTimerRef,
      mediaRecorderRef, recordedChunksRef, pcRef, streamRef, remoteStreamRef,
    });
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setActive(false); resetMetrics(); lastBytesRef.current = 0; lastStatsTimeRef.current = 0; iceFailCountRef.current = 0;
    addLog('Transmisión y cámara detenidas.');
  }, [addLog, resetMetrics]);

  const startRecording = useCallback(() => {
    const remoteStream = remoteStreamRef.current;
    if (!remoteStream || remoteStream.getVideoTracks().length === 0) {
      addLog('Aun no hay video remoto disponible para grabar.');
      return;
    }
    try {
      startWebmRecording(remoteStream, mediaRecorderRef, recordedChunksRef, setIsRecording, addLog);
    } catch (error: unknown) {
      addLog(`No se pudo iniciar la grabación: ${getCameraErrorMessage(error)}`);
    }
  }, [addLog]);

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

    attachPeerHandlers({
      pc, remoteStream, remoteStreamRef, remoteVideoRef, pcRef,
      iceFailCountRef, reconnectAttemptRef, iceRetryTimerRef, reconnectFnRef,
      setActive, setReconnecting, addLog, startStatsCollection, resetMetrics,
    });

    await negotiateSdpOffer(pc, endpoint);
    addLog('Negociación WebRTC completada.');
  }, [addLog, resetMetrics, serverUrl, startStatsCollection]);

  const attemptFullReconnection = useCallback(() => {
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) { addLog(`Se alcanzó el límite de ${MAX_RECONNECT_ATTEMPTS} reconexiones.`); stopCamera(); return; }
    reconnectAttemptRef.current += 1;
    const delay = Math.min(1000 * 2 ** (reconnectAttemptRef.current - 1), 30000);
    setReconnecting(true); addLog(`Reconectando en ${delay / 1000} s (${reconnectAttemptRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(async () => {
      try {
        let cur = streamRef.current;
        if (!cur || cur.getTracks().every((t) => t.readyState === 'ended')) cur = await startCamera();
        if (!cur || cur.getTracks().every((t) => t.readyState === 'ended')) throw new Error('No se pudo recuperar el stream de cámara.');
        await establishConnection();
      } catch (error: unknown) { addLog(`Reconexión fallida: ${getCameraErrorMessage(error)}`); reconnectFnRef.current(); }
    }, delay);
  }, [addLog, establishConnection, startCamera, stopCamera]);

  useEffect(() => { reconnectFnRef.current = attemptFullReconnection; return () => { reconnectFnRef.current = () => {}; }; }, [attemptFullReconnection]);

  const startStream = useCallback(async () => {
    if (!streamRef.current) { addLog('Inicia la cámara primero.'); return; }
    setReconnecting(false); reconnectAttemptRef.current = 0;
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    try { await establishConnection(); }
    catch (error: unknown) {
      setActive(false); addLog(`No se pudo conectar: ${getCameraErrorMessage(error)}`);
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    }
  }, [addLog, establishConnection]);

  return {
    stream, active, serverUrl, setServerUrl, logs, reconnecting, isRecording, metrics,
    videoRef, remoteVideoRef, startCamera, stopCamera, startStream, startRecording, stopRecording,
  };
}
