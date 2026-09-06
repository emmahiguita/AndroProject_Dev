/**
 * Domain Port: IStreamTransport
 * SOLID: 
 *   - SRP: Defines contract solely for video stream transmission protocols
 *   - OCP: Allows adding new transports (WebCodecs, NDI, WebRTC, RTSP) without changing consumers
 *   - ISP: Segregates stream start/stop/health from device commands or logs
 */

export interface StreamSessionConfig {
  serial: string;
  displayId?: number;
  maxFps?: number | string;
  maxSize?: number | string;
  bitRate?: string;
  windowTitle?: string;
  windowPosition?: { x: number; y: number };
  videoSource?: 'display' | 'camera';
  turnScreenOff?: boolean;
  stayAwake?: boolean;
  alwaysOnTop?: boolean;
  borderless?: boolean;
}

export interface StreamSessionResult {
  success: boolean;
  alive: boolean;
  sessionId: string;
  pid?: number;
  streamUrl?: string;
  message?: string;
  error?: string;
}

export interface IStreamTransport {
  readonly protocol: 'scrcpy-native' | 'mjpeg-http' | 'webrtc' | 'airplay';
  start(config: StreamSessionConfig): Promise<StreamSessionResult>;
  stop(sessionId: string): Promise<boolean>;
  isAlive(sessionId: string): Promise<boolean>;
}

export interface ISessionManager {
  registerSession(session: StreamSessionConfig): string;
  unregisterSession(sessionId: string): void;
  getActiveSessions(): StreamSessionConfig[];
  getSession(sessionId: string): StreamSessionConfig | undefined;
}
