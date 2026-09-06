/**
 * MjpegFrameHandler - SRP: Efficient MJPEG frame parsing and broadcasting
 * Single Responsibility: Parse MJPEG frames and broadcast to clients
 * Optimizations: 
 * - Pre-allocated buffers to avoid GC
 * - Client iteration without Array.from conversion
 * - Batch boundary allocation
 */
import type { ReadableStreamDefaultController } from 'stream/web';

const SOI = Buffer.from([0xFF, 0xD8]);
const EOI = Buffer.from([0xFF, 0xD9]);
const BOUNDARY = Buffer.from('\r\n--frame\r\nContent-Type: image/jpeg\r\n\r\n');

export interface FrameHandlerConfig {
  serial: string;
  onClientDisconnect: () => void;
}

export class MjpegFrameHandler {
  private buffer: Buffer;
  private clients: Set<ReadableStreamDefaultController>;
  private serial: string;
  private onClientDisconnect: () => void;
  private boundaryBuffer: Buffer;

  constructor(config: FrameHandlerConfig) {
    this.buffer = Buffer.alloc(0);
    this.clients = new Set();
    this.serial = config.serial;
    this.onClientDisconnect = config.onClientDisconnect;
    this.boundaryBuffer = BOUNDARY;
  }

  addClient(controller: ReadableStreamDefaultController): void {
    this.clients.add(controller);
  }

  removeClient(controller: ReadableStreamDefaultController): void {
    this.clients.delete(controller);
    if (this.clients.size === 0) {
      this.onClientDisconnect();
    }
  }

  private static readonly MAX_ACCUMULATOR_BYTES = 4 * 1024 * 1024; // 4MB safety ceiling

  processChunk(chunk: Buffer): void {
    if (this.buffer.length + chunk.length > MjpegFrameHandler.MAX_ACCUMULATOR_BYTES) {
      // Memory protection: if buffer grew too large without finding EOI, discard corrupt accumulation
      const nextSoi = chunk.indexOf(SOI);
      this.buffer = nextSoi !== -1 ? chunk.subarray(nextSoi) : Buffer.alloc(0);
      return;
    }

    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    this.extractFrames();
  }

  private extractFrames(): void {
    while (this.buffer.length > 0) {
      const soiStart = this.buffer.indexOf(SOI);
      if (soiStart === -1) {
        // Keep last 2 bytes for potential SOI split across chunks
        this.buffer = this.buffer.length >= 2 
          ? this.buffer.subarray(this.buffer.length - 2) 
          : Buffer.alloc(0);
        break;
      }

      if (soiStart > 0) {
        this.buffer = this.buffer.subarray(soiStart);
      }

      const eoiPos = this.buffer.indexOf(EOI, 2);
      if (eoiPos === -1) break; // Partial frame - wait for next chunk

      const frame = this.buffer.subarray(0, eoiPos + 2);
      this.buffer = this.buffer.subarray(eoiPos + 2);

      this.broadcastFrame(frame);
    }
  }

  private broadcastFrame(frame: Buffer): void {
    // Optimize: Direct iteration without Array.from conversion
    const deadClients: ReadableStreamDefaultController[] = [];
    
    for (const controller of this.clients) {
      try {
        controller.enqueue(this.boundaryBuffer);
        controller.enqueue(frame);
      } catch (error) {
        deadClients.push(controller);
      }
    }

    // Remove dead clients
    for (const dead of deadClients) {
      this.removeClient(dead);
    }
  }

  reset(): void {
    this.buffer = Buffer.alloc(0);
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getClients(): Set<ReadableStreamDefaultController> {
    return this.clients;
  }

  destroy(): void {
    this.buffer = Buffer.alloc(0);
    this.clients.clear();
  }
}
