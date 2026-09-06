/**
 * Domain Entity: DeviceSession
 * Represents an active projection session for a device display.
 */

export interface DeviceSession {
  sessionId: string; // e.g. "R58M..._display_0"
  serial: string;
  displayId: number;
  model: string;
  platform: 'android' | 'ios';
  isStreaming: boolean;
  fps: number;
  mode: 'scrcpy' | 'mjpeg' | 'webrtc' | 'airplay';
  startedAt: number;
  pid?: number;
}

export function createSessionId(serial: string, displayId: number = 0, source: string = 'display'): string {
  const safeSerial = serial.replace(/[:.]/g, '_');
  return `${safeSerial}_d${displayId}_${source}`;
}
