// ============================================================================
// ARCHIVO: cameraTypes.ts
// QUÉ HACE: Define los contratos TypeScript de métricas WebRTC, servidores TURN
//           y utilidades compartidas para el transmisor de cámara (`/camera`).
// CÓMO FUNCIONA: Centraliza interfaces extendidas de `RTCStats` y valores
//           iniciales de métricas para evitar duplicación y casts dispersos.
// POR QUÉ: Separar los tipos mantiene `useCameraWebRtc.ts` y `camera/page.tsx`
//           por debajo de 200 líneas (SRP / Clean Architecture).
// ============================================================================

export interface CameraMetrics {
  fps: number;
  bitrate: number;
  packetsLost: number;
  jitter: number;
  resolution: string;
  latencyMs: number;
}

export type InboundVideoStats = RTCStats & {
  kind?: string;
  bytesReceived?: number;
  framesPerSecond?: number;
  packetsLost?: number;
  jitter?: number;
  frameWidth?: number;
  frameHeight?: number;
};

export type CandidatePairStats = RTCStats & {
  state?: string;
  currentRoundTripTime?: number;
};

export type TurnServer = {
  url: string;
  username?: string;
  credential?: string;
};

export type RuntimeWindow = Window & {
  _env?: { TURN_SERVERS?: TurnServer[] };
};

export type EncodingWithPriority = RTCRtpEncodingParameters & {
  networkPriority?: 'very-low' | 'low' | 'medium' | 'high';
};

export const INITIAL_METRICS: CameraMetrics = {
  fps: 0,
  bitrate: 0,
  packetsLost: 0,
  jitter: 0,
  resolution: '',
  latencyMs: 0,
};

export interface VisionBackendHealth {
  online: boolean;
  backend: 'cuda' | 'cpu' | 'offline';
  activeConnections: number;
}

export const getCameraErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Verifica si Vision Backend (:8000/health) está activo y si usa CUDA o CPU. */
export async function checkVisionBackendHealth(serverUrl: string): Promise<VisionBackendHealth> {
  try {
    const u = new URL(serverUrl);
    const res = await fetch(`${u.protocol}//${u.host}/health`, { signal: AbortSignal.timeout(2500), cache: 'no-store' });
    if (!res.ok) return { online: false, backend: 'offline', activeConnections: 0 };
    const data = await res.json();
    return {
      online: data.status === 'healthy',
      backend: data.gpu?.cuda_available ? 'cuda' : 'cpu',
      activeConnections: Number(data.webrtc?.active_connections || 0),
    };
  } catch {
    return { online: false, backend: 'offline', activeConnections: 0 };
  }
}
