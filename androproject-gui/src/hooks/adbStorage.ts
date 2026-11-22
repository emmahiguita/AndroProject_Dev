// ============================================================================
// ARCHIVO: adbStorage.ts
// QUÉ HACE: Persiste dispositivos registrados en `localStorage` y centraliza
//           las peticiones HTTP `POST /api/actions` para el ciclo ADB.
// CÓMO FUNCIONA: Define los contratos `RegisteredDevice`, `AdbDevice` y
//           `AdbStatusResponse`, maneja lectura/escritura segura en SSR y
//           unifica el `fetch` JSON en `postAdbAction`.
// POR QUÉ: Evitar repetición de bloques `fetch` en `useAdbConnection.ts` y
//           mantener ambos archivos por debajo de 200 líneas (SRP / DRY).
// ============================================================================

export interface RegisteredDevice {
  serial: string;
  model: string;
  connectionType: 'USB' | 'Wi-Fi';
  ip?: string;
  port?: string;
  lastSeen: number;
  autoConnect: boolean;
}

export interface AdbDevice {
  serial: string;
  state: string;
  model: string;
  connectionType: string;
}

export interface AdbStatusResponse {
  success: boolean;
  serverRunning: boolean;
  devices: AdbDevice[];
  deviceCount: number;
}

const STORAGE_KEY = 'androproject_registered_devices';

export function loadRegisteredDevices(): RegisteredDevice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RegisteredDevice[]) : [];
  } catch {
    return [];
  }
}

export function saveRegisteredDevices(devices: RegisteredDevice[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch { /* cuota excedida */ }
}

export async function postAdbAction<T = Record<string, unknown>>(
  action: string,
  extra: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch('/api/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  });
  return (await res.json()) as T;
}
