// ============================================================================
// ARCHIVO: mjpeg-broadcaster.ts
// QUÉ HACE: Implementa `MjpegParser` y `FrameBroadcaster` para extraer frames
//           JPEG y difundirlos a clientes HTTP MJPEG con cero acumulación en RAM.
// CÓMO FUNCIONA: Escanea marcadores SOI/EOI con límite de 8 MB y mantiene solo
//           el último frame en memoria (`_last`) para entrega instantánea.
// POR QUÉ: Desacoplar el parser/broadcaster mantiene `stream-pipelines.ts`
//           por debajo de 200 líneas (SRP / Clean Architecture).
// ============================================================================

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);
const MAX_BUF = 8 * 1024 * 1024;
export const PART_SEP = Buffer.from('\r\n');

export type Ctrl = ReadableStreamDefaultController<Uint8Array>;

/** Extrae frames JPEG completos (FF D8 ... FF D9) desde un stream binario. */
export class MjpegParser {
  private buf: Buffer = Buffer.alloc(0);

  push(chunk: Buffer, onFrame: (f: Buffer) => void): void {
    if (this.buf.length + chunk.length > MAX_BUF) {
      const s = chunk.indexOf(SOI);
      this.buf = (s >= 0 ? chunk.subarray(s) : Buffer.alloc(0)) as Buffer;
      return;
    }
    this.buf = (this.buf.length === 0 ? chunk : Buffer.concat([this.buf, chunk])) as Buffer;

    while (this.buf.length >= 4) {
      const s = this.buf.indexOf(SOI);
      if (s < 0) { this.buf = Buffer.alloc(0); break; }
      if (s > 0) this.buf = this.buf.subarray(s);
      const e = this.buf.indexOf(EOI, 2);
      if (e < 0) break;
      const frame = Buffer.allocUnsafe(e + 2);
      this.buf.copy(frame, 0, 0, e + 2);
      this.buf = this.buf.subarray(e + 2);
      onFrame(frame);
    }
  }

  reset(): void { this.buf = Buffer.alloc(0); }
}

/** Difunde el último frame capturado a todos los clientes HTTP MJPEG activos. */
export class FrameBroadcaster {
  private readonly clients = new Set<Ctrl>();
  private _last: Buffer | null = null;
  private _lastCt = 'image/jpeg';

  addClient(c: Ctrl): void { this.clients.add(c); }
  removeClient(c: Ctrl): void { this.clients.delete(c); }
  get clientCount(): number { return this.clients.size; }
  get lastFrame(): Buffer | null { return this._last; }
  get lastContentType(): string { return this._lastCt; }

  push(frame: Buffer, contentType = 'image/jpeg'): void {
    this._last = frame;
    this._lastCt = contentType;
    const header = Buffer.from(
      `--frame\r\nContent-Type: ${contentType}\r\nContent-Length: ${frame.length}\r\n\r\n`,
    );
    const dead: Ctrl[] = [];
    for (const c of this.clients) {
      try { c.enqueue(header); c.enqueue(frame); c.enqueue(PART_SEP); }
      catch { dead.push(c); }
    }
    for (const c of dead) this.clients.delete(c);
  }

  destroy(): void {
    for (const c of this.clients) { try { c.close(); } catch {} }
    this.clients.clear();
    this._last = null;
  }
}
