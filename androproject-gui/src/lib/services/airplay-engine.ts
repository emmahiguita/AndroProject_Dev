// ============================================================================
// ARCHIVO: airplay-engine.ts
// QUÉ HACE: Orquestador del receptor AirPlay 2 (Direct3D11 + Bonjour) para
//           recibir pantalla de iPhone/iPad en Windows sin instalar app en iOS.
// CÓMO FUNCIONA: Delega Win32/PrintWindow a `airplay-win32.ts`, sockets TCP a
//           `airplay-sockets.ts` y gestos WDA/SVG a `airplay-wda-touch.ts`.
// POR QUÉ: Refactorizado de 771 → <180 líneas cumpliendo SRP y cero código muerto.
// ============================================================================

import { exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { ANDROPROJECT_HOME, getLockFile, writeLock, killLockedProcess } from '@/lib/config';
import type { DeviceInfo, AirPlayServerStatus } from '@/features/types';
import {
  resolveAirPlayDir, getLocalIpAndMac, findRunningAirPlayPid, spawnAirPlayProcess,
  syncAirPlaySettingsIni, ensureBonjourDaemon, focusAirPlayWindow, captureAirPlayWindowPng,
} from './airplay-win32';
import {
  injectAirPlayTap, injectAirPlaySwipe, injectAirPlayText, buildAirPlayStandbySvg,
  DEFAULT_AIRPLAY_OPTIONS, type AirPlayServerOptions, type IAirPlayReceiverEngine,
} from './airplay-wda-touch';
import { detectAirPlaySocketIps } from './airplay-sockets';

export type { AirPlayServerOptions, IAirPlayReceiverEngine };
const execAsync = promisify(exec);
const AIRPLAY_LOCK_NAME = 'airplay_receiver_server';

class AirPlayReceiverEngine implements IAirPlayReceiverEngine {
  private currentOptions: AirPlayServerOptions = { ...DEFAULT_AIRPLAY_OPTIONS };
  private isRunning = false;
  private serverProcess: ChildProcess | null = null;
  private latestWindowFrame: Buffer | null = null;
  private latestWindowFrameTs = 0;
  private lastCaptureAttempt = 0;
  private captureBackoffMs = 250;
  private captureInFlight = false;
  private mouseControlEnabled = true;
  private connectedClients = new Map<string, {
    clientName: string; clientIp: string; model: string; resolution: string;
    fps: number; audioActive: boolean; connectedAt: number;
  }>();

  constructor() {
    if (fs.existsSync(getLockFile(AIRPLAY_LOCK_NAME))) this.isRunning = true;
  }

  public async setAudioEnabled(enabled: boolean): Promise<AirPlayServerStatus> {
    this.currentOptions.audioEnabled = Boolean(enabled);
    syncAirPlaySettingsIni(resolveAirPlayDir(), this.currentOptions.serverName, this.currentOptions.pinRequired, this.currentOptions.audioEnabled);
    await this.stop();
    return this.start({ audioEnabled: this.currentOptions.audioEnabled });
  }

  public async focusNativeWindow(): Promise<boolean> { return focusAirPlayWindow(); }

  public async start(options?: Partial<AirPlayServerOptions>): Promise<AirPlayServerStatus> {
    this.currentOptions = {
      ...DEFAULT_AIRPLAY_OPTIONS, ...this.currentOptions, ...(options || {}),
      port: options?.port || this.currentOptions.port || 7001,
      serverName: options?.serverName || this.currentOptions.serverName || 'AndroProject [PC]',
      audioEnabled: options?.audioEnabled !== undefined ? Boolean(options.audioEnabled) : Boolean(this.currentOptions.audioEnabled),
    };
    const lockFile = getLockFile(AIRPLAY_LOCK_NAME);
    try {
      fs.mkdirSync(path.join(ANDROPROJECT_HOME, 'airplay'), { recursive: true });
      const airplayDir = resolveAirPlayDir();
      syncAirPlaySettingsIni(airplayDir, this.currentOptions.serverName, this.currentOptions.pinRequired, this.currentOptions.audioEnabled);
      await ensureBonjourDaemon(airplayDir);

      let pid = await findRunningAirPlayPid();
      if (!pid) {
        this.serverProcess = spawnAirPlayProcess(airplayDir);
        if (this.serverProcess) {
          await new Promise((r) => setTimeout(r, 800));
          pid = (await findRunningAirPlayPid()) || this.serverProcess?.pid || null;
        }
      } else { await focusAirPlayWindow(); }

      this.isRunning = Boolean(pid);
      if (pid) writeLock(lockFile, { pid, serial: 'airplay', processName: 'AirPlayServer.exe', owner: 'airplay' });
      this.triggerWindowCapture();
      console.log(`[AirPlay Engine] Activo en "${this.currentOptions.serverName}" (${getLocalIpAndMac().ip}:7001)`);
      return this.getStatus();
    } catch { this.isRunning = false; return this.getStatus(); }
  }

  public async stop(): Promise<boolean> {
    await killLockedProcess(getLockFile(AIRPLAY_LOCK_NAME));
    try { await execAsync('taskkill /F /IM AirPlayServer.exe /T', { windowsHide: true, timeout: 3000 }); } catch {}
    try { this.serverProcess?.kill(); } catch {}
    this.serverProcess = null;
    this.isRunning = false;
    this.latestWindowFrame = null;
    this.connectedClients.clear();
    return true;
  }

  public async getStatus(): Promise<AirPlayServerStatus> {
    const alive = Boolean(await findRunningAirPlayPid());
    this.isRunning = alive;
    if (alive) {
      const activeIps = await detectAirPlaySocketIps();
      for (const ip of activeIps) {
        if (!this.connectedClients.has(ip)) this.registerClient(ip, 'iPhone (AirPlay 2)', 'iPhone');
      }
      for (const ip of Array.from(this.connectedClients.keys())) {
        if (!activeIps.has(ip)) this.connectedClients.delete(ip);
      }
    }
    return {
      running: alive, port: this.currentOptions.port || 7001, serverName: this.currentOptions.serverName,
      bonjourActive: alive, pinRequired: this.currentOptions.pinRequired, pinCode: this.currentOptions.pinCode,
      connectedClients: Array.from(this.connectedClients.values()).map(({ clientName, clientIp, model, resolution, fps, audioActive }) => ({
        clientName, clientIp, model, resolution, fps, audioActive,
      })),
    };
  }

  public async openNativeWindow(): Promise<boolean> { await this.start(); return focusAirPlayWindow(); }

  public toggleMouseControl() {
    this.mouseControlEnabled = !this.mouseControlEnabled;
    return { success: true, active: this.mouseControlEnabled, message: this.mouseControlEnabled ? 'Control iOS activado' : 'Control iOS desactivado' };
  }

  public registerClient(clientIp: string, clientName = 'iPhone', model = 'iPhone') {
    this.connectedClients.set(clientIp, {
      clientName, clientIp, model, resolution: '1179 × 2556',
      fps: this.currentOptions.maxFps, audioActive: this.currentOptions.audioEnabled, connectedAt: Date.now(),
    });
  }

  public unregisterClient(clientIp: string) { this.connectedClients.delete(clientIp); }

  public getConnectedDevices(): DeviceInfo[] {
    return Array.from(this.connectedClients.entries()).map(([ip, c]) => ({
      connected: true, platform: 'ios', connectionType: 'Wi-Fi', model: `${c.model} (AirPlay)`,
      serial: `airplay-${ip.replace(/[.:]/g, '-')}`, iosVersion: 'iOS', resolution: c.resolution,
      state: 'device', airplayClientName: c.clientName, airplayResolution: c.resolution,
      airplayFps: c.fps, airplayAudioEnabled: c.audioActive,
    }));
  }

  public injectTap(x: number, y: number) { return injectAirPlayTap(x, y); }
  public injectSwipe(x1: number, y1: number, x2: number, y2: number, d = 200) { return injectAirPlaySwipe(x1, y1, x2, y2, d); }
  public injectText(text: string) { return injectAirPlayText(text); }

  public async setServerName(name: string): Promise<boolean> {
    if (!name.trim()) return false;
    this.currentOptions.serverName = name.trim();
    syncAirPlaySettingsIni(resolveAirPlayDir(), this.currentOptions.serverName, this.currentOptions.pinRequired, this.currentOptions.audioEnabled);
    return true;
  }

  public async setPin(pin: string): Promise<boolean> {
    this.currentOptions.pinCode = pin;
    this.currentOptions.pinRequired = Boolean(pin.trim());
    syncAirPlaySettingsIni(resolveAirPlayDir(), this.currentOptions.serverName, this.currentOptions.pinRequired, this.currentOptions.audioEnabled);
    return true;
  }

  private triggerWindowCapture(): void {
    if (this.captureInFlight || !this.isRunning || this.connectedClients.size === 0) return;
    const now = Date.now();
    if (now - this.lastCaptureAttempt < this.captureBackoffMs) return;
    this.lastCaptureAttempt = now;
    this.captureInFlight = true;
    captureAirPlayWindowPng()
      .then((buf) => {
        if (buf) { this.latestWindowFrame = buf; this.latestWindowFrameTs = Date.now(); this.captureBackoffMs = 250; }
        else this.captureBackoffMs = 2000;
      })
      .catch(() => { this.captureBackoffMs = 2000; })
      .finally(() => { this.captureInFlight = false; });
  }

  public getLatestFrameContentType(): string {
    return this.latestWindowFrame && Date.now() - this.latestWindowFrameTs < 15000 ? 'image/png' : 'image/svg+xml';
  }

  public getLatestFrame(_serial: string): Buffer {
    this.triggerWindowCapture();
    return this.latestWindowFrame && Date.now() - this.latestWindowFrameTs < 15000
      ? this.latestWindowFrame
      : buildAirPlayStandbySvg();
  }
}

export const airPlayReceiverEngine = new AirPlayReceiverEngine();
