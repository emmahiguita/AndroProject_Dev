// ============================================================================
// ARCHIVO: ios-types.ts
// QUÉ HACE: Define los contratos `IosDeviceInfo`, `IosWdaStatus`, `IIosBridge`
//           y el helper `wdaRequest` para peticiones HTTP con timeout a WDA.
// CÓMO FUNCIONA: Centraliza las interfaces públicas de automatización iOS y
//           encapsula `fetch` + `AbortSignal.timeout` + parsing JSON seguro.
// POR QUÉ: Evitar repetición de bloques `fetch` en `ios-bridge.ts` y mantener
//           todos los archivos del puente iOS por debajo de 200 líneas (SRP/DRY).
// ============================================================================

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

/** Ejecuta una petición JSON hacia WebDriverAgent con timeout y tolerancia a fallos. */
export async function wdaRequest<T = any>(
  url: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; statusText: string; data?: T }> {
  const { method = 'GET', body, timeoutMs = 2000 } = options;
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  let data: T | undefined;
  try {
    data = (await res.json()) as T;
  } catch {}
  return { ok: res.ok, status: res.status, statusText: res.statusText, data };
}
