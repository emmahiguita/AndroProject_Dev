// ============================================================================
// ARCHIVO: cameraMediaHelpers.ts
// QUÉ HACE: Gestiona captura de cámara (trasera/frontal/webcam con fallback),
//           enumeración de cámaras, instantáneas PNG, grabación WebM y limpieza
//           determinista de streams, timers y `RTCPeerConnection`.
// CÓMO FUNCIONA: Intenta 4K/60fps con audio, degrada a resolución estándar o
//           solo video si el hardware/permiso de micrófono falla, y libera
//           recursos en `disposeCameraResources`.
// POR QUÉ: Evitar fallos `OverconstrainedError` / `NotFoundError` en móviles
//          y PCs manteniendo < 200 líneas (SRP).
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

/** Lista las cámaras disponibles en el dispositivo/navegador. */
export async function listVideoInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'videoinput');
}

/** Restores the camera's minimum optical zoom when the browser exposes it. */
export async function resetCameraZoom(stream: MediaStream): Promise<boolean> {
  const track = stream.getVideoTracks()[0];
  if (!track) return false;
  const capabilities = track.getCapabilities() as MediaTrackCapabilities & { zoom?: number | { min: number; max: number; step?: number } };
  const zoom = capabilities.zoom;
  if (zoom === undefined) return false;
  const minimum = typeof zoom === 'number' ? zoom : zoom.min;
  if (!Number.isFinite(minimum)) return false;
  try {
    await track.applyConstraints({ advanced: [{ zoom: minimum } as MediaTrackConstraintSet] });
    return true;
  } catch {
    // Some Samsung camera providers advertise zoom but reject browser constraints.
    return false;
  }
}

/** Solicita cámara con fallback progresivo (4K60+audio -> HD+audio -> solo video). */
export async function requestCameraStream(
  facingMode: 'environment' | 'user' = 'environment',
  deviceId?: string,
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Acceso a cámara bloqueado (requiere HTTPS o localhost / adb reverse tcp:3000).');
  }

  const videoPref: MediaTrackConstraints = deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, min: 15 } }
    : { facingMode: { ideal: facingMode }, width: { ideal: 3840, min: 640 }, height: { ideal: 2160, min: 480 }, frameRate: { ideal: 60, min: 15 } };

  const audioPref: MediaTrackConstraints = {
    echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 48000, channelCount: 2,
  };

  try {
    return await navigator.mediaDevices.getUserMedia({ video: videoPref, audio: audioPref });
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: facingMode } },
        audio: true,
      });
    } catch {
      return await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
      });
    }
  }
}

/** Toma una fotografía instantánea PNG del elemento de video activo. */
export function captureVideoSnapshot(videoEl: HTMLVideoElement | null): number {
  if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
    throw new Error('El video aún no tiene frames listos para capturar.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo inicializar el lienzo 2D.');
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `androproject_foto_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, 'image/png');
  return canvas.width * canvas.height;
}

/** Inicia grabación WebM del stream y libera `recordedChunksRef` al descargar. */
export function startWebmRecording(
  targetStream: MediaStream,
  mediaRecorderRef: MutableRefObject<MediaRecorder | null>,
  recordedChunksRef: MutableRefObject<Blob[]>,
  setIsRecording: (value: boolean) => void,
  addLog: (msg: string) => void,
): void {
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
  recordedChunksRef.current = [];
  const rec = new MediaRecorder(targetStream, { mimeType, videoBitsPerSecond: 10_000_000 });
  rec.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
  rec.onstop = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current === rec) mediaRecorderRef.current = null;
    const blob = new Blob(recordedChunksRef.current, { type: mimeType });
    recordedChunksRef.current = [];
    if (blob.size === 0) { addLog('La grabación terminó sin datos.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `androproject_grabacion_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    addLog(`Grabación guardada (${(blob.size / 1024 / 1024).toFixed(1)} MB).`);
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
