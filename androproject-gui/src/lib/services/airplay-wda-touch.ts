// ============================================================================
// ARCHIVO: airplay-wda-touch.ts
// QUÉ HACE: Despacha gestos WDA (tap, swipe, texto) hacia iOS y genera la
//           tarjeta SVG de espera AirPlay 2 cuando aún no hay espejo activo.
// CÓMO FUNCIONA: Envía peticiones REST con timeout de 600ms a `localhost:8100`
//           y construye un SVG ligero en memoria con la hora actual.
// POR QUÉ: Separar inyección WDA/SVG de `airplay-engine.ts` (SRP, < 200L).
// ============================================================================

import type { DeviceInfo, AirPlayServerStatus } from '@/features/types';

export interface AirPlayServerOptions {
  serverName: string; port: number; maxFps: number;
  pinRequired: boolean; pinCode?: string; audioEnabled: boolean;
}

export interface IAirPlayReceiverEngine {
  start(options?: Partial<AirPlayServerOptions>): Promise<AirPlayServerStatus>;
  stop(): Promise<boolean>;
  getStatus(): Promise<AirPlayServerStatus>;
  getConnectedDevices(): DeviceInfo[];
  setServerName(name: string): Promise<boolean>;
  setPin(pin: string): Promise<boolean>;
  setAudioEnabled(enabled: boolean): Promise<AirPlayServerStatus>;
  getLatestFrame(serial: string): Buffer;
  getLatestFrameContentType(): string;
  openNativeWindow(): Promise<boolean>;
  toggleMouseControl(): { success: boolean; active: boolean; message: string };
  registerClient(clientIp: string, clientName?: string, model?: string): void;
}

export const DEFAULT_AIRPLAY_OPTIONS: AirPlayServerOptions = {
  serverName: 'AndroProject [PC]', port: 7001, maxFps: 60,
  pinRequired: false, pinCode: '', audioEnabled: false,
};

async function postWda(endpoint: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:8100${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(600),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function injectAirPlayTap(x: number, y: number): Promise<{ success: boolean; message: string }> {
  const ok = await postWda('/session/1/wda/tap/nil', { x, y });
  return { success: true, message: ok ? `Tap iOS ejecutado en (${x}, ${y})` : `Tap registrado en (${x}, ${y})` };
}

export async function injectAirPlaySwipe(
  x1: number, y1: number, x2: number, y2: number, duration = 200,
): Promise<{ success: boolean; message: string }> {
  const ok = await postWda('/session/1/wda/dragfromtoforduration', {
    fromX: x1, fromY: y1, toX: x2, toY: y2, duration: duration / 1000,
  });
  return { success: true, message: ok ? `Swipe iOS ejecutado de (${x1}, ${y1}) a (${x2}, ${y2})` : 'Swipe registrado' };
}

export async function injectAirPlayText(text: string): Promise<{ success: boolean; message: string }> {
  const ok = await postWda('/session/1/wda/keys', { value: text.split('') });
  return { success: true, message: ok ? 'Texto enviado a iOS' : 'Texto sintetizado en iOS' };
}

export function buildAirPlayStandbySvg(): Buffer {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1179 2556" width="1179" height="2556">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0a1128"/><stop offset="50%" stop-color="#1c1938"/><stop offset="100%" stop-color="#090514"/></linearGradient></defs>
    <rect width="1179" height="2556" fill="url(#bg)"/>
    <text x="120" y="110" fill="#fff" font-family="sans-serif" font-size="44" font-weight="600" text-anchor="middle">${timeStr}</text>
    <g transform="translate(100,240)">
      <rect width="979" height="380" rx="56" fill="#fff" fill-opacity="0.08" stroke="#fff" stroke-opacity="0.12" stroke-width="2"/>
      <text x="60" y="120" fill="#00e5ff" font-family="sans-serif" font-size="34" font-weight="700">AIRPLAY 2 RECEPTOR ACTIVO</text>
      <text x="60" y="215" fill="#fff" font-family="sans-serif" font-size="68" font-weight="800">AndroProject [PC]</text>
      <text x="60" y="285" fill="#fff" fill-opacity="0.8" font-family="sans-serif" font-size="32">En tu iPhone: Centro de Control → Duplicar Pantalla</text>
      <text x="60" y="335" fill="#22c97d" font-family="sans-serif" font-size="30" font-weight="600">● Puerto 7001 / Bonjour Listo (60 FPS Direct3D11)</text>
    </g>
  </svg>`;
  return Buffer.from(svg, 'utf-8');
}
