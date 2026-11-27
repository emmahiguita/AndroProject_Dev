// ============================================================================
// ARCHIVO: actionApi.ts
// QUÉ HACE: Helpers HTTP puros para `useActions`: ejecuta `/api/actions`,
//           `/api/patch-app` y proyección paralela en múltiples dispositivos.
// CÓMO FUNCIONA: Extrae la IP cuando `activeSerial` incluye puerto mDNS,
//           maneja errores de red sin lanzar excepciones no controladas y
//           devuelve respuestas tipadas.
// POR QUÉ: Separar las llamadas HTTP puras mantiene `useActions.ts` bajo
//           el límite estricto de 200 líneas (SRP / Clean Architecture).
// ============================================================================

import { apiUrl } from '@/lib/api-url';
export async function postActionRequest(
  action: string,
  activeSerial: string | null,
  deviceIP: string | null,
  extraBody: Record<string, unknown> = {},
): Promise<Record<string, any>> {
  const dIP = activeSerial?.includes(':') ? activeSerial.split(':')[0] : deviceIP;
  const r = await fetch(apiUrl('/api/actions'), {
    method: 'POST',
    body: JSON.stringify({ action, ip: dIP, serial: activeSerial, ...extraBody }),
    headers: { 'Content-Type': 'application/json' },
  });
  return (await r.json()) as Record<string, any>;
}

export async function projectScreensBatch(
  devicesList: Array<{ serial: string }>,
  videoSource: string,
) {
  return Promise.all(
    devicesList.map(async ({ serial }) => {
      try {
        const res = await fetch(apiUrl('/api/actions'), {
          method: 'POST',
          body: JSON.stringify({ action: 'open_screen', serial, videoSource }),
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return { serial, success: Boolean(data.success), error: data.error as string | undefined };
      } catch {
        return { serial, success: false, error: 'Error de conexión' };
      }
    }),
  );
}
