// ============================================================================
// ARCHIVO: scrcpy-session-hub.ts
// QUÉ HACE: Administra sesiones persistentes de scrcpy-server v4.1 por serial,
//           entregando paquetes H.264 (60 FPS) e inyección táctil (< 2ms).
// CÓMO FUNCIONA: Empuja scrcpy-server al móvil, abre túnel TCP ADB para video
//           y control, cachea SPS/PPS + keyframe y difunde frames a clientes.
// POR QUÉ: Reemplazar screencap (2 FPS) y adb shell input (475ms) por video
//           H.264 nativo 60 FPS + tacto binario sincronizado.
// ============================================================================

import { spawn, execFileSync, type ChildProcess } from 'child_process';
import net from 'net';
import fs from 'fs';
import { ADB, SCRCPY_SERVER_PATH } from '@/lib/config';
import { packH264Frame, classifyH264Payload, buildTouchPacket } from './scrcpy-protocol';

interface ActiveSession {
  serial: string;
  port: number;
  srvProc: ChildProcess;
  videoSock: net.Socket | null;
  ctrlSock: net.Socket | null;
  width: number;
  height: number;
  configPacket: Buffer | null;
  lastKeyPacket: Buffer | null;
  listeners: Set<(rawFrame: Buffer) => void>;
  readyResolve?: () => void;
  readyPromise: Promise<void>;
  idleTimer: ReturnType<typeof setTimeout> | null;
  destroyed: boolean;
}

const g = globalThis as unknown as { __scrcpySessions?: Map<string, ActiveSession>; __scrcpyNextPort?: number };
const sessions = (g.__scrcpySessions ??= new Map<string, ActiveSession>());
if (!g.__scrcpyNextPort) g.__scrcpyNextPort = 27210;

function allocPort(): number {
  const p = g.__scrcpyNextPort!++;
  if (g.__scrcpyNextPort! > 27900) g.__scrcpyNextPort = 27210;
  return p;
}

function destroySession(serial: string): void {
  const s = sessions.get(serial);
  if (!s || s.destroyed) return;
  s.destroyed = true;
  if (s.idleTimer) clearTimeout(s.idleTimer);
  sessions.delete(serial);
  try { s.videoSock?.destroy(); } catch {}
  try { s.ctrlSock?.destroy(); } catch {}
  try { s.srvProc.kill('SIGKILL'); } catch {}
  try { execFileSync(ADB, ['-s', serial, 'forward', '--remove', `tcp:${s.port}`], { windowsHide: true, timeout: 1500 }); } catch {}
}

function startSession(serial: string): ActiveSession {
  const port = allocPort();
  const scid = Math.floor(Math.random() * 0x7fffffff).toString(16).padStart(8, '0');

  if (fs.existsSync(SCRCPY_SERVER_PATH)) {
    try {
      execFileSync(ADB, ['-s', serial, 'push', SCRCPY_SERVER_PATH, '/data/local/tmp/scrcpy-server.jar'], { windowsHide: true, timeout: 4000 });
    } catch {
      try { execFileSync(ADB, ['reconnect', 'offline'], { windowsHide: true, timeout: 2500 }); } catch {}
    }
  }
  try {
    execFileSync(ADB, ['-s', serial, 'forward', `tcp:${port}`, `localabstract:scrcpy_${scid}`], { windowsHide: true, timeout: 3000 });
  } catch {
    execFileSync(ADB, ['reconnect', 'offline'], { windowsHide: true, timeout: 2500 });
    execFileSync(ADB, ['-s', serial, 'forward', `tcp:${port}`, `localabstract:scrcpy_${scid}`], { windowsHide: true, timeout: 3000 });
  }

  const srvProc = spawn(ADB, [
    '-s', serial, 'shell',
    'CLASSPATH=/data/local/tmp/scrcpy-server.jar',
    'app_process', '/', 'com.genymobile.scrcpy.Server', '4.1',
    `scid=${scid}`, 'log_level=info', 'tunnel_forward=true', 'audio=false', 'control=true',
    'cleanup=false', 'max_size=1080', 'max_fps=60', 'video_bit_rate=8000000',
    'stay_awake=true',
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

  let readyResolve!: () => void;
  const readyPromise = new Promise<void>((res) => { readyResolve = res; });

  const session: ActiveSession = {
    serial, port, srvProc, videoSock: null, ctrlSock: null,
    width: 324, height: 720, configPacket: null, lastKeyPacket: null,
    listeners: new Set(), readyResolve, readyPromise, idleTimer: null, destroyed: false,
  };

  let buf: Buffer = Buffer.alloc(0);
  let gotDummy = false;
  let gotHeader = false;
  let connected = false;

  const connectSockets = () => {
    if (connected || session.destroyed) return;
    connected = true;
    const vSock = net.createConnection({ host: '127.0.0.1', port }, () => {
      const cSock = net.createConnection({ host: '127.0.0.1', port });
      cSock.setNoDelay(true);
      cSock.on('error', () => {});
      session.ctrlSock = cSock;
    });
    vSock.setNoDelay(true);
    session.videoSock = vSock;

    vSock.on('data', (chunk: Buffer) => {
      buf = buf.length === 0 ? Buffer.from(chunk) : Buffer.concat([buf, chunk]);
      if (!gotDummy && buf.length >= 1) { gotDummy = true; buf = buf.subarray(1); }
      // scrcpy 4.1 tunnel_forward: 1B dummy, luego 64B device + 4B codec + 4B flags + 4B width + 4B height
      if (gotDummy && !gotHeader && buf.length >= 80) {
        session.width = buf.readUInt32BE(72) || 486;
        session.height = buf.readUInt32BE(76) || 1080;
        buf = buf.subarray(80);
        gotHeader = true;
        session.readyResolve?.();
      }
      while (gotHeader && buf.length >= 12) {
        const ptsHi = buf.readUInt32BE(0);
        const ptsLo = buf.readUInt32BE(4);
        const size = buf.readUInt32BE(8);
        if (size > 8 * 1024 * 1024) { buf = Buffer.alloc(0); break; }
        if (buf.length < 12 + size) break;
        const payload = Buffer.from(buf.subarray(12, 12 + size));
        buf = buf.subarray(12 + size);

        const { isConfig, isKey } = classifyH264Payload(ptsHi, payload);
        const framed = packH264Frame(isConfig ? ((ptsHi | 0x80000000) >>> 0) : ptsHi, ptsLo, payload);
        if (isConfig) session.configPacket = framed;
        else if (isKey) session.lastKeyPacket = framed;
        for (const fn of session.listeners) { try { fn(framed); } catch {} }
      }
    });
    vSock.on('error', () => destroySession(serial));
    vSock.on('close', () => destroySession(serial));
  };

  const onLog = (d: Buffer) => {
    if (!connected && d.toString().includes('INFO: Device:')) setTimeout(connectSockets, 120);
  };
  srvProc.stdout?.on('data', onLog);
  srvProc.stderr?.on('data', onLog);
  srvProc.on('exit', () => destroySession(serial));
  setTimeout(connectSockets, 1200);

  sessions.set(serial, session);
  return session;
}

/** Obtiene o inicia una sesión H.264 + Control persistente para el serial. */
export async function getOrStartScrcpySession(serial: string): Promise<ActiveSession> {
  let s = sessions.get(serial);
  if (!s || s.destroyed) s = startSession(serial);
  if (s.idleTimer) { clearTimeout(s.idleTimer); s.idleTimer = null; }
  await Promise.race([s.readyPromise, new Promise((r) => setTimeout(r, 3500))]);
  return s;
}

/** Suscribe un cliente de video con replay inmediato de SPS/PPS + último keyframe. */
export function subscribeScrcpyVideo(serial: string, listener: (frame: Buffer) => void): () => void {
  const s = sessions.get(serial);
  if (!s) return () => {};
  if (s.idleTimer) { clearTimeout(s.idleTimer); s.idleTimer = null; }
  if (s.configPacket) listener(s.configPacket);
  if (s.lastKeyPacket) listener(s.lastKeyPacket);
  s.listeners.add(listener);

  return () => {
    s.listeners.delete(listener);
    if (s.listeners.size === 0 && !s.destroyed) {
      s.idleTimer = setTimeout(() => { if (s.listeners.size === 0) destroySession(serial); }, 10000);
    }
  };
}

/** Inyecta un evento táctil binario (< 2ms) directo al socket de control scrcpy. */
export function injectScrcpyTouch(serial: string, action: 0 | 1 | 2, normX: number, normY: number): boolean {
  const s = sessions.get(serial);
  if (!s || s.destroyed || !s.ctrlSock || !s.ctrlSock.writable) return false;
  return s.ctrlSock.write(buildTouchPacket(action, normX, normY, s.width, s.height));
}
