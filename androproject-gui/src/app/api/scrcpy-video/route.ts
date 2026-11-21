// ============================================================================
// ARCHIVO: scrcpy-video/route.ts
// QUÉ HACE: Endpoint HTTP binario que transmite frames H.264 crudos a 60 FPS
//           directamente desde scrcpy-server v4.1 hacia WebCodecs en el navegador.
// CÓMO FUNCIONA: Envía cabecera de 12 bytes ('SC41' + width + height) seguida
//           de paquetes [8B ptsFlags + 4B size + payload H.264].
// POR QUÉ: Cero FFmpeg, cero JPEG/PNG, latencia < 40ms a 60 FPS reales.
// ============================================================================
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { getOrStartScrcpySession, subscribeScrcpyVideo } from '@/lib/services/scrcpy-session-hub';

export async function GET(req: NextRequest) {
  const serial = req.nextUrl.searchParams.get('serial') || '';
  if (!serial || serial.startsWith('airplay-') || serial.startsWith('apple-')) {
    return new Response('Android serial requerido', { status: 400 });
  }

  let session;
  try {
    session = await getOrStartScrcpySession(serial);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`Error iniciando stream H.264: ${msg}`, { status: 500 });
  }

  let unsub: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Cabecera inicial: 4B magic 'SC41' + 4B width + 4B height
      const hdr = Buffer.allocUnsafe(12);
      hdr.write('SC41', 0, 'ascii');
      hdr.writeUInt32BE(session.width, 4);
      hdr.writeUInt32BE(session.height, 8);
      controller.enqueue(new Uint8Array(hdr));

      unsub = subscribeScrcpyVideo(serial, (frame) => {
        try {
          controller.enqueue(new Uint8Array(frame));
        } catch {
          unsub?.();
        }
      });

      req.signal.addEventListener('abort', () => {
        unsub?.();
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      unsub?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Accel-Buffering': 'no',
    },
  });
}
