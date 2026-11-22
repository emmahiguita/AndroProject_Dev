// ============================================================================
// ARCHIVO: ios-stream-handler.ts
// QUÉ HACE: Entrega fotogramas en vivo (MJPEG o captura única) para dispositivos
//           iOS (`airplay-*` y `apple-*`) desde `airPlayReceiverEngine`.
// CÓMO FUNCIONA: Captura frames de la ventana Direct3D11 de `AirPlayServer.exe`
//           o devuelve la tarjeta SVG de estado AirPlay cuando aún no duplica.
// POR QUÉ: Evitar que `/api/device-stream` invoque `adb` con seriales iOS y
//           mantener `device-stream/route.ts` modular (SRP, < 200 líneas).
// ============================================================================

import { airPlayReceiverEngine } from './airplay-engine';

const PART_SEP = Buffer.from('\r\n');

/** Indica si un serial pertenece a un dispositivo iOS (AirPlay o USB Apple). */
export function isIosStreamSerial(serial: string): boolean {
  return serial.startsWith('airplay-') || serial.startsWith('apple-');
}

/** Responde con un stream MJPEG o captura única para iOS sin invocar ADB. */
export function handleIosDeviceStream(serial: string, mode: string | null, maxFps = 30, signal?: AbortSignal): Response {
  if (mode === 'screenshot' || mode === 'single') {
    const frame = airPlayReceiverEngine.getLatestFrame(serial);
    const ct = airPlayReceiverEngine.getLatestFrameContentType();
    return new Response(new Uint8Array(frame), {
      headers: { 'Content-Type': ct, 'Cache-Control': 'no-store, max-age=0' },
    });
  }

  const intervalMs = Math.max(33, Math.round(1000 / Math.min(Math.max(maxFps, 5), 30)));
  let timer: ReturnType<typeof setInterval> | null = null;
  const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      const pushFrame = () => {
        try {
          const frame = airPlayReceiverEngine.getLatestFrame(serial);
          const ct = airPlayReceiverEngine.getLatestFrameContentType();
          ctrl.enqueue(Buffer.from(`--frame\r\nContent-Type: ${ct}\r\nContent-Length: ${frame.length}\r\n\r\n`));
          ctrl.enqueue(new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength));
          ctrl.enqueue(PART_SEP);
        } catch {
          stopTimer();
        }
      };
      pushFrame();
      timer = setInterval(pushFrame, intervalMs);
      signal?.addEventListener('abort', stopTimer, { once: true });
    },
    cancel() {
      stopTimer();
    },
  });

  return new Response(stream as unknown as BodyInit, {
    headers: {
      'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Frame-Mode': 'airplay-ios',
    },
  });
}
