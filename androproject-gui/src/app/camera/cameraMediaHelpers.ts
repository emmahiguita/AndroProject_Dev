// ============================================================================
// ARCHIVO: cameraMediaHelpers.ts
// QUÉ HACE: Gestiona captura de cámara trasera, grabación WebM y limpieza
//           determinista de streams, timers y `RTCPeerConnection`.
// CÓMO FUNCIONA: Encapsula `getUserMedia`, `MediaRecorder` (liberando chunks
//           de RAM tras generar el Blob) y `disposeCameraResources`.
// POR QUÉ: Aplicar SRP manteniendo `useCameraWebRtc.ts` y `cameraRtcHelpers.ts`
//           por debajo de 200 líneas sin duplicar lógica de limpieza.
// ============================================================================

import type { MutableRefObject } from 'react';

export interface CameraRefsBundle {
  statsIntervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
  reconnectTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  iceRetryTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  mediaRecorderRef: MutableRefObject<MediaRecorder | null>;
  recordedChunksRef: MutableRefObject<Blob[]>;
  pcRef: MutableRefObject<RTCPeerConnection | null>;
  streamRef: MutableRefObject<MediaStream | null>;
  remoteStreamRef: MutableRefObject<MediaStream | null>;
}

/** Solicita cámara trasera 4K/60fps y audio estéreo sin procesamiento agresivo. */
export async function requestBackCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no permite acceder a la cámara.');
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 3840, min: 1280 }, height: { ideal: 2160, min: 720 }, frameRate: { ideal: 60, min: 30 } },
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 48000, channelCount: 2 },
  });
}

/** Inicia grabación WebM del stream remoto y libera `recordedChunksRef` al descargar. */
export function startWebmRecording(
  remoteStream: MediaStream,
  mediaRecorderRef: MutableRefObject<MediaRecorder | null>,
  recordedChunksRef: MutableRefObject<Blob[]>,
  setIsRecording: (value: boolean) => void,
  addLog: (msg: string) => void,
): void {
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
  recordedChunksRef.current = [];
  const rec = new MediaRecorder(remoteStream, { mimeType, videoBitsPerSecond: 10_000_000 });
  rec.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
  rec.onstop = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current === rec) mediaRecorderRef.current = null;
    const blob = new Blob(recordedChunksRef.current, { type: mimeType });
    recordedChunksRef.current = [];
    if (blob.size === 0) { addLog('La grabacion termino sin datos.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `androproject_grabacion_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    addLog(`Grabacion guardada (${(blob.size / 1024 / 1024).toFixed(1)} MB).`);
  };
  rec.start(1000);
  mediaRecorderRef.current = rec;
  setIsRecording(true);
}

/** Libera timers, grabadora, RTCPeerConnection y tracks locales/remotos. */
export function disposeCameraResources(refs: CameraRefsBundle): void {
  if (refs.statsIntervalRef.current) { clearInterval(refs.statsIntervalRef.current); refs.statsIntervalRef.current = null; }
  if (refs.reconnectTimerRef.current) { clearTimeout(refs.reconnectTimerRef.current); refs.reconnectTimerRef.current = null; }
  if (refs.iceRetryTimerRef.current) { clearTimeout(refs.iceRetryTimerRef.current); refs.iceRetryTimerRef.current = null; }
  const rec = refs.mediaRecorderRef.current;
  if (rec && rec.state !== 'inactive') rec.stop();
  refs.mediaRecorderRef.current = null;
  if (refs.pcRef.current) {
    refs.pcRef.current.ontrack = null;
    refs.pcRef.current.oniceconnectionstatechange = null;
    refs.pcRef.current.close();
    refs.pcRef.current = null;
  }
  refs.streamRef.current?.getTracks().forEach((t) => t.stop());
  refs.streamRef.current = null;
  refs.remoteStreamRef.current = null;
  refs.recordedChunksRef.current = [];
}
