// ============================================================================
// ARCHIVO: webcodecs-h264-player.ts
// QUÉ HACE: Driver resiliente de decodificación H.264 por GPU (WebCodecs) sobre
//           /api/scrcpy-video con auto-reconexión, rotación dinámica y 0 parpadeo.
// CÓMO FUNCIONA: Lee cabecera 'SC41' + frames [8B ptsFlags + 4B size + H.264],
//           reconfigura VideoDecoder si cambia SPS/PPS (rotación), resincroniza
//           en keyframes y reconecta automáticamente ante cortes sin borrar el canvas.
// POR QUÉ: Garantizar imagen 100% estable a 60 FPS sin pérdidas ni pantallas negras.
// ============================================================================

export interface WebCodecsPlayerCallbacks {
  onFrameRendered?: () => void;
  onFps?: (fps: number) => void;
  onError?: () => void;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function bytesEqual(a: Uint8Array | null, b: Uint8Array): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Inicia la decodificación H.264 por GPU con watchdog de auto-reconexión. */
export function startWebCodecsH264Player(
  serial: string,
  getCanvas: () => HTMLCanvasElement | null,
  getCallbacks: () => WebCodecsPlayerCallbacks,
): () => void {
  if (typeof window === 'undefined' || !('VideoDecoder' in window)) {
    getCallbacks().onError?.();
    return () => {};
  }

  let stopped = false;
  let activeAbort: AbortController | null = null;
  let decoder: VideoDecoder | null = null;
  let retryDelay = 400;

  const closeDecoder = () => {
    try { if (decoder && decoder.state !== 'closed') decoder.close(); } catch {}
    decoder = null;
  };

  const runLoop = async () => {
    while (!stopped) {
      activeAbort = new AbortController();
      let spsPps: Uint8Array | null = null;
      let configured = false;
      let waitingForKey = true;
      let frames = 0;
      let lastTick = performance.now();
      let hadFirstFrame = false;

      try {
        const res = await fetch(`/api/scrcpy-video?serial=${encodeURIComponent(serial)}`, {
          signal: activeAbort.signal,
          cache: 'no-store',
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        retryDelay = 400;
        const reader = res.body.getReader();
        let buf: Uint8Array = new Uint8Array(0);
        let headerParsed = false;
        let vidW = 720;
        let vidH = 1600;
        let decoderFailed = false;

        decoder = new VideoDecoder({
          output: (frame) => {
            const canvas = getCanvas();
            if (canvas) {
              if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
                canvas.width = frame.displayWidth;
                canvas.height = frame.displayHeight;
              }
              const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
              if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(frame, 0, 0);
              }
            }
            frame.close();
            frames++;
            if (!hadFirstFrame) {
              hadFirstFrame = true;
              getCallbacks().onFrameRendered?.();
            }
            const now = performance.now();
            if (now - lastTick >= 1000) {
              getCallbacks().onFps?.(Math.round((frames * 1000) / (now - lastTick)));
              frames = 0;
              lastTick = now;
            }
          },
          error: () => {
            decoderFailed = true;
            activeAbort?.abort();
          },
        });

        while (!stopped && !decoderFailed) {
          const { value, done } = await reader.read();
          if (done || !value) break;
          buf = buf.length === 0 ? value : concatBytes(buf, value);

          if (!headerParsed && buf.length >= 12) {
            const view = new DataView(buf.buffer, buf.byteOffset, 12);
            vidW = view.getUint32(4, false) || 720;
            vidH = view.getUint32(8, false) || 1600;
            buf = buf.subarray(12);
            headerParsed = true;
          }

          while (headerParsed && buf.length >= 12) {
            const hdr = new DataView(buf.buffer, buf.byteOffset, 12);
            const ptsHi = hdr.getUint32(0, false);
            const size = hdr.getUint32(8, false);
            if (size > 8 * 1024 * 1024) { buf = new Uint8Array(0); break; }
            if (buf.length < 12 + size) break;

            const payload = buf.slice(12, 12 + size);
            buf = buf.subarray(12 + size);

            const isConfig = (ptsHi & 0x80000000) !== 0;
            const nalType = payload.length >= 5 ? (payload[4] & 0x1f) : 0;
            const isKey = ((ptsHi & 0x40000000) !== 0) || nalType === 5;

            if (isConfig || nalType === 7) {
              const changed = !bytesEqual(spsPps, payload);
              spsPps = payload;
              if ((!configured || changed) && decoder.state !== 'closed') {
                decoder.configure({
                  codec: 'avc1.420028',
                  codedWidth: vidW,
                  codedHeight: vidH,
                  optimizeForLatency: true,
                  hardwareAcceleration: 'prefer-hardware',
                });
                configured = true;
                waitingForKey = true;
              }
              continue;
            }

            if (!configured || decoder.state === 'closed') continue;
            if (waitingForKey && !isKey) continue;

            // Si la cola se satura en P-frames, esperar al próximo keyframe limpio (cero artefactos)
            if (!isKey && decoder.decodeQueueSize > 6) {
              waitingForKey = true;
              continue;
            }

            const chunkData = isKey && spsPps ? concatBytes(spsPps, payload) : payload;
            waitingForKey = false;
            decoder.decode(new EncodedVideoChunk({
              type: isKey ? 'key' : 'delta',
              timestamp: performance.now() * 1000,
              data: chunkData,
            }));
          }
        }
      } catch {
        // Error transitorio: reconectar conservando el último fotograma dibujado
      } finally {
        closeDecoder();
      }

      if (!stopped) {
        await new Promise((r) => setTimeout(r, retryDelay));
        retryDelay = Math.min(2000, retryDelay + 400);
      }
    }
  };

  runLoop();

  return () => {
    stopped = true;
    activeAbort?.abort();
    closeDecoder();
  };
}
