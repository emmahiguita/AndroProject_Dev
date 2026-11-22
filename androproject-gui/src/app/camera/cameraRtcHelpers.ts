// ============================================================================
// ARCHIVO: cameraRtcHelpers.ts
// QUÉ HACE: Helpers WebRTC para `/camera`: healthcheck de Vision Backend,
//           lectura de métricas RTP, `RTCPeerConnection`, eventos ICE/track y
//           negociación SDP con recolección ICE completa.
// CÓMO FUNCIONA: Espera a `iceGatheringState === 'complete'` (máx 1.5s) antes
//           de enviar el SDP Offer al endpoint FastAPI `/vision/offer`.
// POR QUÉ: Garantizar conectividad ICE real y diagnóstico previo del backend (<200L).
// ============================================================================

import type { MutableRefObject } from 'react';
import type {
  CameraMetrics,
  CandidatePairStats,
  EncodingWithPriority,
  InboundVideoStats,
  RuntimeWindow,
} from './cameraTypes';

const MAX_ICE_RETRIES = 3;

export interface PeerHandlerDeps {
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  remoteStreamRef: MutableRefObject<MediaStream | null>;
  remoteVideoRef: MutableRefObject<HTMLVideoElement | null>;
  pcRef: MutableRefObject<RTCPeerConnection | null>;
  iceFailCountRef: MutableRefObject<number>;
  reconnectAttemptRef: MutableRefObject<number>;
  iceRetryTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  reconnectFnRef: MutableRefObject<() => void>;
  setActive: (v: boolean) => void;
  setReconnecting: (v: boolean) => void;
  addLog: (msg: string) => void;
  startStatsCollection: () => void;
  resetMetrics: () => void;
}

export async function readPeerMetrics(
  pc: RTCPeerConnection,
  prevBytes: number,
  prevTime: number,
): Promise<{ metrics?: Partial<CameraMetrics>; bytes: number; time: number } | null> {
  if (pc.connectionState !== 'connected') return null;
  const reports: RTCStats[] = [];
  (await pc.getStats()).forEach((r) => reports.push(r as RTCStats));

  const inbound = reports.find(
    (r): r is InboundVideoStats => r.type === 'inbound-rtp' && (r as InboundVideoStats).kind === 'video',
  );
  if (!inbound) return null;

  const pair = reports.find(
    (r): r is CandidatePairStats => r.type === 'candidate-pair' && (r as CandidatePairStats).state === 'succeeded',
  );
  const latencyMs = typeof pair?.currentRoundTripTime === 'number'
    ? Math.round(pair.currentRoundTripTime * 1000)
    : undefined;

  const now = Date.now();
  const bytes = inbound.bytesReceived || 0;
  let bitrate = 0;
  if (prevBytes > 0 && prevTime > 0 && bytes > prevBytes) {
    bitrate = Math.round(((bytes - prevBytes) * 8) / ((now - prevTime) / 1000) / 1_000_000);
  }

  return {
    bytes,
    time: now,
    metrics: {
      fps: Math.round(inbound.framesPerSecond || 0),
      bitrate,
      packetsLost: inbound.packetsLost || 0,
      jitter: Math.round((inbound.jitter || 0) * 1000),
      resolution: `${inbound.frameWidth || '?'}×${inbound.frameHeight || '?'}`,
      ...(latencyMs !== undefined ? { latencyMs } : {}),
    },
  };
}

export function createConfiguredPeer(localStream: MediaStream): RTCPeerConnection {
  const configuredTurn = (window as RuntimeWindow)._env?.TURN_SERVERS ?? [];
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      ...configuredTurn.filter((s) => s.url).map((s) => ({
        urls: s.url, username: s.username, credential: s.credential,
      })),
    ],
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 0,
  });

  localStream.getTracks().forEach((track) => {
    const sender = pc.addTrack(track, localStream);
    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    const enc = params.encodings[0] as EncodingWithPriority;
    if (track.kind === 'video') {
      enc.maxBitrate = 20_000_000;
      enc.maxFramerate = 60;
      enc.networkPriority = 'high';
    } else {
      enc.maxBitrate = 192_000;
    }
    void sender.setParameters(params).catch(() => {});
  });

  return pc;
}

export function attachPeerHandlers(deps: PeerHandlerDeps): void {
  const {
    pc, remoteStream, remoteStreamRef, remoteVideoRef, pcRef,
    iceFailCountRef, reconnectAttemptRef, iceRetryTimerRef, reconnectFnRef,
    setActive, setReconnecting, addLog, startStatsCollection, resetMetrics,
  } = deps;

  pc.ontrack = (event) => {
    if (remoteStreamRef.current !== remoteStream) return;
    if (!remoteStream.getTracks().some((t) => t.id === event.track.id)) remoteStream.addTrack(event.track);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      if (event.track.kind === 'audio') remoteVideoRef.current.muted = false;
      void remoteVideoRef.current.play().catch(() => {});
    }
    addLog(event.track.kind === 'video' ? 'Video procesado recibido.' : 'Audio remoto recibido.');
  };

  pc.oniceconnectionstatechange = () => {
    const state = pc.iceConnectionState;
    addLog(`ICE: ${state}`);
    if (state === 'connected' || state === 'completed') {
      setActive(true); setReconnecting(false); reconnectAttemptRef.current = 0; iceFailCountRef.current = 0;
      addLog('Transmisión WebRTC activa.'); startStatsCollection();
    } else if (state === 'disconnected') {
      setActive(false); addLog('Conexión temporalmente interrumpida; WebRTC intentará recuperarla.');
    } else if (state === 'failed') {
      setActive(false); iceFailCountRef.current += 1;
      addLog(`ICE falló (${iceFailCountRef.current}/${MAX_ICE_RETRIES}).`);
      if (iceFailCountRef.current <= MAX_ICE_RETRIES) pc.restartIce();
      if (iceRetryTimerRef.current) clearTimeout(iceRetryTimerRef.current);
      iceRetryTimerRef.current = setTimeout(() => {
        if (pcRef.current === pc && pc.iceConnectionState === 'failed') reconnectFnRef.current();
      }, 2000);
    } else if (state === 'closed') {
      setActive(false); resetMetrics(); iceFailCountRef.current = 0;
    }
  };
}

function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 1500): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => { pc.removeEventListener('icegatheringstatechange', onState); resolve(); }, timeoutMs);
    const onState = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onState);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', onState);
  });
}

export async function negotiateSdpOffer(pc: RTCPeerConnection, endpoint: URL): Promise<void> {
  const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
  await pc.setLocalDescription({
    type: offer.type,
    sdp: (offer.sdp ?? '').replace(/b=AS:\d+/g, 'b=AS:20000'),
  });
  await waitForIceGathering(pc, 1500);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sdp: pc.localDescription?.sdp, type: pc.localDescription?.type }),
  });
  if (!response.ok) throw new Error(`El servidor respondió ${response.status}: ${response.statusText}`);
  const answer = (await response.json()) as RTCSessionDescriptionInit;
  if (answer.type !== 'answer' || typeof answer.sdp !== 'string') {
    throw new Error('El servidor devolvió una respuesta SDP inválida.');
  }
  await pc.setRemoteDescription(answer);
}
