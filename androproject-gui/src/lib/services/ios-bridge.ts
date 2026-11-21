/**
 * iOS Bridge — Native Windows iOS Automation, Control & Testing Suite
 *
 * Implements IIosBridge for complete iOS programmatic control from Windows:
 * 1. WebDriverAgent (WDA) REST Client on localhost:8100:
 *    - Coordinate Taps, Swipes, Long Press, Text Synthesis
 *    - Hardware buttons: Home, Lock, Volume Up, Volume Down
 *    - App lifecycle: launchApp, terminateApp, activeApp
 *    - UI Tree Dump (XML hierarchy) for Test Automation / QA
 * 2. pymobiledevice3 Windows Driver CLI:
 *    - USB discovery via Apple usbmuxd (VID 05AC)
 *    - USB Tunnel Forwarding (remote forward 8100 8100)
 *    - Developer DVT Native Screenshots
 *    - Device Lockdown Diagnostics (Battery, iOS Version, UDID)
 * 3. Bluetooth HID / AssistiveTouch Guidance:
 *    - Coordinates Windows mouse cursor to iOS touch
 */

import { exec, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { SCREENSHOTS_DIR } from '@/lib/config';

const execAsync = promisify(exec);

export interface IosDeviceInfo {
  udid?: string;
  name?: string;
  model?: string;
  iosVersion?: string;
  batteryLevel?: number;
  connectionType: 'USB' | 'Wi-Fi' | 'AirPlay';
  wdaAvailable: boolean;
}

export interface IosWdaStatus {
  ready: boolean;
  state?: string;
  sessionId?: string;
  iosVersion?: string;
  device?: string;
  error?: string;
}

export interface IIosBridge {
  checkWdaStatus(): Promise<IosWdaStatus>;
  tap(x: number, y: number): Promise<{ success: boolean; message: string }>;
  swipe(x1: number, y1: number, x2: number, y2: number, duration?: number): Promise<{ success: boolean; message: string }>;
  typeText(text: string): Promise<{ success: boolean; message: string }>;
  pressButton(button: 'home' | 'volumeUp' | 'volumeDown' | 'lock'): Promise<{ success: boolean; message: string }>;
  launchApp(bundleId: string): Promise<{ success: boolean; message: string }>;
  terminateApp(bundleId: string): Promise<{ success: boolean; message: string }>;
  getActiveApp(): Promise<{ success: boolean; bundleId?: string; processId?: number }>;
  getUiHierarchy(): Promise<{ success: boolean; xml?: string; error?: string }>;
  takeScreenshot(filename?: string): Promise<{ success: boolean; path?: string; error?: string }>;
  openUrl(url: string): Promise<{ success: boolean; message: string }>;
  listUsbDevices(): Promise<IosDeviceInfo[]>;
  listInstalledApps(): Promise<{ success: boolean; apps: { bundleId: string; name: string; version?: string }[]; error?: string }>;
  startTunnel(wdaPort?: number): Promise<{ success: boolean; message: string; pid?: number }>;
}

export class IosBridge implements IIosBridge {
  private wdaBaseUrl: string = 'http://localhost:8100';
  private cachedSessionId: string | null = null;
  private tunnelProcess: ChildProcess | null = null;

  constructor(customWdaUrl?: string) {
    if (customWdaUrl) {
      this.wdaBaseUrl = customWdaUrl.replace(/\/$/, '');
    }
  }

  /**
   * Checks if WebDriverAgent server is currently running and responsive.
   */
  public async checkWdaStatus(): Promise<IosWdaStatus> {
    try {
      const res = await fetch(`${this.wdaBaseUrl}/status`, {
        signal: AbortSignal.timeout(1200),
      });
      if (!res.ok) {
        return { ready: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }
      const data = await res.json() as {
        sessionId?: string;
        status?: number;
        value?: { state?: string; os?: { version?: string }; ios?: { simulatorVersion?: string } };
      };
      const ready = Boolean(data?.value?.state === 'success' || data?.sessionId || data?.status === 0);
      if (data?.sessionId) {
        this.cachedSessionId = data.sessionId;
      }
      return {
        ready,
        state: data?.value?.state || 'ready',
        sessionId: data?.sessionId,
        iosVersion: data?.value?.os?.version,
        device: data?.value?.ios?.simulatorVersion ? 'Simulator' : 'Physical Device',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'WDA no disponible en localhost:8100';
      return { ready: false, error: msg };
    }
  }

  /**
   * Retrieves active WDA session ID or creates a default session.
   */
  private async getSessionId(): Promise<string> {
    if (this.cachedSessionId) return this.cachedSessionId;
    try {
      const res = await fetch(`${this.wdaBaseUrl}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilities: {} }),
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data: any = await res.json();
        const id = data?.sessionId || data?.value?.sessionId || '1';
        this.cachedSessionId = id;
        return id;
      }
    } catch {}
    return '1';
  }

  /**
   * Injects a tap gesture on iOS device at (x, y) coordinates via real WDA session.
   */
  public async tap(x: number, y: number): Promise<{ success: boolean; message: string }> {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const sid = await this.getSessionId();

    try {
      const res = await fetch(`${this.wdaBaseUrl}/session/${sid}/wda/tap/nil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: rx, y: ry }),
        signal: AbortSignal.timeout(1200),
      });
      if (res.ok) return { success: true, message: `Tap iOS WDA ejecutado en (${rx}, ${ry})` };
    } catch {}

    try {
      const resPoint = await fetch(`${this.wdaBaseUrl}/wda/tap/point`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: rx, y: ry }),
        signal: AbortSignal.timeout(1200),
      });
      if (resPoint.ok) return { success: true, message: `Tap iOS ejecutado en (${rx}, ${ry})` };
    } catch {}

    return {
      success: false,
      message: `WDA no conectado en localhost:8100. Inicia el túnel USB o usa Bluetooth AssistiveTouch.`,
    };
  }

  /**
   * Injects a smooth swipe gesture from (x1, y1) to (x2, y2).
   */
  public async swipe(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    duration: number = 250,
  ): Promise<{ success: boolean; message: string }> {
    const sid = await this.getSessionId();
    try {
      const res = await fetch(`${this.wdaBaseUrl}/session/${sid}/wda/dragfromtoforduration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromX: Math.round(x1),
          fromY: Math.round(y1),
          toX: Math.round(x2),
          toY: Math.round(y2),
          duration: Math.max(0.1, duration / 1000),
        }),
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return { success: true, message: `Swipe iOS ejecutado de (${x1}, ${y1}) a (${x2}, ${y2})` };
    } catch {}

    return { success: false, message: `WDA no conectado en localhost:8100 para ejecutar swipe.` };
  }

  /**
   * Types text onto iOS active focused input.
   */
  public async typeText(text: string): Promise<{ success: boolean; message: string }> {
    const sid = await this.getSessionId();
    try {
      const res = await fetch(`${this.wdaBaseUrl}/session/${sid}/wda/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: text.split('') }),
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) return { success: true, message: `Texto sintetizado en iOS: "${text.slice(0, 20)}..."` };
    } catch {}

    return { success: false, message: `WDA no conectado en localhost:8100 para escribir texto.` };
  }

  /**
   * Presses hardware button (home, lock, volumeUp, volumeDown).
   */
  public async pressButton(button: 'home' | 'volumeUp' | 'volumeDown' | 'lock'): Promise<{ success: boolean; message: string }> {
    const endpointMap: Record<string, string> = {
      home: `${this.wdaBaseUrl}/wda/homescreen`,
      lock: `${this.wdaBaseUrl}/wda/lock`,
      volumeUp: `${this.wdaBaseUrl}/wda/pressButton`,
      volumeDown: `${this.wdaBaseUrl}/wda/pressButton`,
    };

    const targetUrl = endpointMap[button] || `${this.wdaBaseUrl}/wda/homescreen`;
    const payload = (button === 'volumeUp' || button === 'volumeDown') ? { name: button } : {};

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        return { success: true, message: `Botón iOS "${button}" presionado` };
      }
    } catch {}

    // Fallback: if 'home', try home swipe gesture
    if (button === 'home') {
      return this.swipe(200, 900, 200, 500, 150);
    }

    return { success: false, message: `WDA no conectado en localhost:8100 para botón "${button}".` };
  }

  /**
   * Launches an app on the iOS device by bundle ID.
   */
  public async launchApp(bundleId: string): Promise<{ success: boolean; message: string }> {
    const cleanId = bundleId.trim();
    try {
      const res = await fetch(`${this.wdaBaseUrl}/session/1/wda/apps/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId: cleanId }),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        return { success: true, message: `Aplicación "${cleanId}" iniciada en iOS` };
      }
    } catch {}

    return { success: false, message: `No se pudo iniciar "${cleanId}". Verifica que WDA esté activo.` };
  }

  /**
   * Terminates an app on the iOS device by bundle ID.
   */
  public async terminateApp(bundleId: string): Promise<{ success: boolean; message: string }> {
    const cleanId = bundleId.trim();
    try {
      const res = await fetch(`${this.wdaBaseUrl}/session/1/wda/apps/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId: cleanId }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return { success: true, message: `Aplicación "${cleanId}" cerrada en iOS` };
      }
    } catch {}

    return { success: false, message: `No se pudo cerrar "${cleanId}".` };
  }

  /**
   * Retrieves currently active foreground app on iOS.
   */
  public async getActiveApp(): Promise<{ success: boolean; bundleId?: string; processId?: number }> {
    try {
      const res = await fetch(`${this.wdaBaseUrl}/session/1/wda/activeAppInfo`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const data: any = await res.json();
        const info = data?.value || {};
        return {
          success: true,
          bundleId: info.bundleId,
          processId: info.processIdentifier,
        };
      }
    } catch {}

    return { success: false };
  }

  /**
   * Dumps full UI hierarchy of the iOS screen (XML format) for test automation.
   */
  public async getUiHierarchy(): Promise<{ success: boolean; xml?: string; error?: string }> {
    try {
      const res = await fetch(`${this.wdaBaseUrl}/source?format=xml`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data: any = await res.json();
        const xml = data?.value || '';
        return { success: true, xml };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al obtener jerarquía UI' };
    }
    return { success: false, error: 'WDA no devolvió la jerarquía de pantalla' };
  }

  /**
   * Captures raw high-resolution screenshot from iOS via WDA or pymobiledevice3.
   */
  public async takeScreenshot(filename?: string): Promise<{ success: boolean; path?: string; error?: string }> {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const localPath = path.join(SCREENSHOTS_DIR, filename || `ios_screenshot_${timestamp}.png`);

    // 1. Try WDA native screenshot
    try {
      const res = await fetch(`${this.wdaBaseUrl}/screenshot`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data: any = await res.json();
        const b64 = data?.value;
        if (b64 && typeof b64 === 'string') {
          const buf = Buffer.from(b64, 'base64');
          if (buf.length > 1000) {
            fs.writeFileSync(localPath, buf);
            return { success: true, path: localPath };
          }
        }
      }
    } catch {}

    // 2. Try pymobiledevice3 developer screenshot via python module
    try {
      await execAsync(`python -m pymobiledevice3 developer dvt screenshot "${localPath}"`, {
        windowsHide: true,
        timeout: 6000,
      });
      if (fs.existsSync(localPath) && fs.statSync(localPath).size > 1000) {
        return { success: true, path: localPath };
      }
    } catch {}

    return {
      success: false,
      error: 'No se pudo capturar pantalla iOS. Conecta WDA en el puerto 8100 o usa AirPlay.',
    };
  }

  /**
   * Opens URL in Mobile Safari on the device.
   */
  public async openUrl(url: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.wdaBaseUrl}/session/1/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return { success: true, message: `URL abierta en Safari: ${url}` };
      }
    } catch {}

    return { success: false, message: 'Error al abrir URL en Safari' };
  }

  /**
   * Discovers Apple devices connected to Windows PC via USB (VID 05AC).
   */
  public async listUsbDevices(): Promise<IosDeviceInfo[]> {
    const list: IosDeviceInfo[] = [];

    try {
      const { stdout } = await execAsync('pnputil /enum-devices /connected /class USB', {
        windowsHide: true,
        timeout: 2000,
      });

      if (/VID_05AC/i.test(stdout)) {
        const wda = await this.checkWdaStatus();
        list.push({
          connectionType: 'USB',
          model: 'Apple iPhone / iPad',
          iosVersion: wda.iosVersion || 'iOS',
          wdaAvailable: wda.ready,
        });
      }
    } catch {}

    return list;
  }

  /**
   * Lista las aplicaciones reales (Bundle IDs) instaladas en un iPhone/iPad
   * conectado por USB usando `python -m pymobiledevice3 apps list`.
   */
  public async listInstalledApps(): Promise<{
    success: boolean;
    apps: { bundleId: string; name: string; version?: string }[];
    error?: string;
  }> {
    try {
      const { stdout } = await execAsync('python -m pymobiledevice3 apps list --color=false', {
        windowsHide: true,
        timeout: 10000,
        maxBuffer: 8 * 1024 * 1024,
      });
      const parsed = JSON.parse(stdout) as Record<string, { CFBundleDisplayName?: string; CFBundleName?: string; CFBundleShortVersionString?: string }>;
      const apps = Object.entries(parsed).map(([bundleId, meta]) => ({
        bundleId,
        name: meta?.CFBundleDisplayName || meta?.CFBundleName || bundleId,
        version: meta?.CFBundleShortVersionString,
      }));
      return { success: true, apps };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Conecta un iPhone por USB y confía en este PC.';
      return { success: false, apps: [], error: msg };
    }
  }

  /**
   * Starts usbmuxd tunnel forwarding from iPhone port 8100 to Windows localhost:8100.
   */
  public async startTunnel(wdaPort: number = 8100): Promise<{ success: boolean; message: string; pid?: number }> {
    try {
      // Check if port 8100 is already listening
      const wdaCheck = await this.checkWdaStatus();
      if (wdaCheck.ready) {
        return { success: true, message: `Túnel WDA ya activo en http://localhost:${wdaPort}` };
      }

      // Launch python -m pymobiledevice3 usbmux forward in background (works across all Windows PATH setups)
      const proc = spawn('python', ['-m', 'pymobiledevice3', 'usbmux', 'forward', String(wdaPort), String(wdaPort)], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      proc.unref();

      this.tunnelProcess = proc;
      return {
        success: true,
        message: `Túnel USB WDA iniciado en http://localhost:${wdaPort} (PID: ${proc.pid})`,
        pid: proc.pid,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Para activar el túnel ejecuta en PowerShell: "pip install pymobiledevice3" y luego "pymobiledevice3 remote forward 8100 8100"`,
      };
    }
  }
}

export const iosBridge: IIosBridge = new IosBridge();
