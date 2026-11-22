// ============================================================================
// ARCHIVO: ios-bridge.ts
// QUÉ HACE: Cliente REST WebDriverAgent (WDA) y fachada `IIosBridge` para
//           automatizar dispositivos iOS desde Windows (toques, teclas, apps).
// CÓMO FUNCIONA: Resuelve y cachea el `sessionId` real de WDA (corrigiendo
//           rutas que antes hardcodeaban `/session/1`), usa `wdaRequest` para
//           comunicación HTTP y delega utilidades USB a `ios-usb-tools.ts`.
// POR QUÉ: Mantener este puente < 200 líneas (SRP / DIP) y evitar fallos con
//           sesiones UUID reales de WDA o procesos túnel duplicados.
// ============================================================================

import { wdaRequest, type IIosBridge, type IosDeviceInfo, type IosWdaStatus } from './ios-types';
import {
  listAppleUsbDevices,
  listIosInstalledApps,
  startIosTunnel,
  takeIosScreenshot,
} from './ios-usb-tools';

export type { IosDeviceInfo, IosWdaStatus, IIosBridge };

export class IosBridge implements IIosBridge {
  private wdaBaseUrl: string = 'http://localhost:8100';
  private cachedSessionId: string | null = null;

  constructor(customWdaUrl?: string) {
    if (customWdaUrl) this.wdaBaseUrl = customWdaUrl.replace(/\/$/, '');
  }

  public async checkWdaStatus(): Promise<IosWdaStatus> {
    try {
      const res = await wdaRequest<{
        sessionId?: string;
        status?: number;
        value?: { state?: string; os?: { version?: string }; ios?: { simulatorVersion?: string } };
      }>(`${this.wdaBaseUrl}/status`, { timeoutMs: 1200 });

      if (!res.ok) return { ready: false, error: `HTTP ${res.status}: ${res.statusText}` };
      const data = res.data;
      const ready = Boolean(data?.value?.state === 'success' || data?.sessionId || data?.status === 0);
      if (data?.sessionId) this.cachedSessionId = data.sessionId;
      return {
        ready,
        state: data?.value?.state || 'ready',
        sessionId: data?.sessionId,
        iosVersion: data?.value?.os?.version,
        device: data?.value?.ios?.simulatorVersion ? 'Simulator' : 'Physical Device',
      };
    } catch (err: unknown) {
      return { ready: false, error: err instanceof Error ? err.message : 'WDA no disponible en localhost:8100' };
    }
  }

  private async getSessionId(): Promise<string> {
    if (this.cachedSessionId) return this.cachedSessionId;
    try {
      const res = await wdaRequest<{ sessionId?: string; value?: { sessionId?: string } }>(
        `${this.wdaBaseUrl}/session`,
        { method: 'POST', body: { capabilities: {} }, timeoutMs: 2000 },
      );
      if (res.ok) {
        const id = res.data?.sessionId || res.data?.value?.sessionId || '1';
        this.cachedSessionId = id;
        return id;
      }
    } catch {}
    return '1';
  }

  public async tap(x: number, y: number): Promise<{ success: boolean; message: string }> {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const sid = await this.getSessionId();
    try {
      const res = await wdaRequest(`${this.wdaBaseUrl}/session/${sid}/wda/tap/nil`, {
        method: 'POST', body: { x: rx, y: ry }, timeoutMs: 1200,
      });
      if (res.ok) return { success: true, message: `Tap iOS WDA ejecutado en (${rx}, ${ry})` };
    } catch {}
    try {
      const resPt = await wdaRequest(`${this.wdaBaseUrl}/wda/tap/point`, {
        method: 'POST', body: { x: rx, y: ry }, timeoutMs: 1200,
      });
      if (resPt.ok) return { success: true, message: `Tap iOS ejecutado en (${rx}, ${ry})` };
    } catch {}
    return { success: false, message: 'WDA no conectado en localhost:8100. Inicia el túnel USB o usa Bluetooth AssistiveTouch.' };
  }

  public async swipe(x1: number, y1: number, x2: number, y2: number, duration = 250) {
    const sid = await this.getSessionId();
    try {
      const res = await wdaRequest(`${this.wdaBaseUrl}/session/${sid}/wda/dragfromtoforduration`, {
        method: 'POST',
        body: {
          fromX: Math.round(x1), fromY: Math.round(y1),
          toX: Math.round(x2), toY: Math.round(y2),
          duration: Math.max(0.1, duration / 1000),
        },
        timeoutMs: 2000,
      });
      if (res.ok) return { success: true, message: `Swipe iOS ejecutado de (${x1}, ${y1}) a (${x2}, ${y2})` };
    } catch {}
    return { success: false, message: 'WDA no conectado en localhost:8100 para ejecutar swipe.' };
  }

  public async typeText(text: string): Promise<{ success: boolean; message: string }> {
    const sid = await this.getSessionId();
    try {
      const res = await wdaRequest(`${this.wdaBaseUrl}/session/${sid}/wda/keys`, {
        method: 'POST', body: { value: text.split('') }, timeoutMs: 2500,
      });
      if (res.ok) return { success: true, message: `Texto sintetizado en iOS: "${text.slice(0, 20)}..."` };
    } catch {}
    return { success: false, message: 'WDA no conectado en localhost:8100 para escribir texto.' };
  }

  public async pressButton(button: 'home' | 'volumeUp' | 'volumeDown' | 'lock') {
    const endpointMap: Record<string, string> = {
      home: `${this.wdaBaseUrl}/wda/homescreen`,
      lock: `${this.wdaBaseUrl}/wda/lock`,
      volumeUp: `${this.wdaBaseUrl}/wda/pressButton`,
      volumeDown: `${this.wdaBaseUrl}/wda/pressButton`,
    };
    const payload = button === 'volumeUp' || button === 'volumeDown' ? { name: button } : {};
    try {
      const res = await wdaRequest(endpointMap[button] || `${this.wdaBaseUrl}/wda/homescreen`, {
        method: 'POST', body: payload, timeoutMs: 1500,
      });
      if (res.ok) return { success: true, message: `Botón iOS "${button}" presionado` };
    } catch {}
    if (button === 'home') return this.swipe(200, 900, 200, 500, 150);
    return { success: false, message: `WDA no conectado en localhost:8100 para botón "${button}".` };
  }

  private async postSessionAction(pathSuffix: string, body: unknown, timeoutMs: number, okMsg: string, failMsg: string) {
    const sid = await this.getSessionId();
    try {
      const res = await wdaRequest(`${this.wdaBaseUrl}/session/${sid}${pathSuffix}`, { method: 'POST', body, timeoutMs });
      if (res.ok) return { success: true, message: okMsg };
    } catch {}
    return { success: false, message: failMsg };
  }

  public launchApp(bundleId: string) {
    const cleanId = bundleId.trim();
    return this.postSessionAction('/wda/apps/launch', { bundleId: cleanId }, 4000, `Aplicación "${cleanId}" iniciada en iOS`, `No se pudo iniciar "${cleanId}". Verifica que WDA esté activo.`);
  }

  public terminateApp(bundleId: string) {
    const cleanId = bundleId.trim();
    return this.postSessionAction('/wda/apps/terminate', { bundleId: cleanId }, 3000, `Aplicación "${cleanId}" cerrada en iOS`, `No se pudo cerrar "${cleanId}".`);
  }

  public async getActiveApp(): Promise<{ success: boolean; bundleId?: string; processId?: number }> {
    const sid = await this.getSessionId();
    try {
      const res = await wdaRequest<{ value?: { bundleId?: string; processIdentifier?: number } }>(
        `${this.wdaBaseUrl}/session/${sid}/wda/activeAppInfo`, { timeoutMs: 1500 },
      );
      if (res.ok) {
        return { success: true, bundleId: res.data?.value?.bundleId, processId: res.data?.value?.processIdentifier };
      }
    } catch {}
    return { success: false };
  }

  public async getUiHierarchy(): Promise<{ success: boolean; xml?: string; error?: string }> {
    try {
      const res = await wdaRequest<{ value?: string }>(`${this.wdaBaseUrl}/source?format=xml`, { timeoutMs: 4000 });
      if (res.ok) return { success: true, xml: res.data?.value || '' };
      return { success: false, error: 'WDA no devolvió la jerarquía de pantalla' };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Error al obtener jerarquía UI' };
    }
  }

  public takeScreenshot(filename?: string) {
    return takeIosScreenshot(this.wdaBaseUrl, filename);
  }

  public openUrl(url: string) {
    return this.postSessionAction('/url', { url }, 3000, `URL abierta en Safari: ${url}`, 'Error al abrir URL en Safari');
  }

  public listUsbDevices() { return listAppleUsbDevices(() => this.checkWdaStatus()); }
  public listInstalledApps() { return listIosInstalledApps(); }
  public startTunnel(wdaPort: number = 8100) { return startIosTunnel(wdaPort, () => this.checkWdaStatus()); }
}

export const iosBridge: IIosBridge = new IosBridge();
