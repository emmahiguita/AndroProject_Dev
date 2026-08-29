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

  processChunk(chunk: Buffer): void {
    // Optimize: Pre-allocate combined buffer size
    const combined = Buffer.alloc(this.buffer.length + chunk.length);
    this.buffer.copy(combined, 0);
    chunk.copy(combined, this.buffer.length);
    this.buffer = combined;

    this.extractFrames();
  }

  private extractFrames(): void {
    while (true) {
      const soiStart = this.buffer.indexOf(SOI);
      if (soiStart === -1) {
        // Keep last 2 bytes for potential SOI across chunks
        this.buffer = this.buffer.length >= 2 
          ? this.buffer.subarray(this.buffer.length - 2) 
          : Buffer.alloc(0);
        break;
      }

      if (soiStart > 0) {
        this.buffer = this.buffer.subarray(soiStart);
      }

      const eoiPos = this.buffer.indexOf(EOI, 2);
      if (eoiPos === -1) break; // Partial frame - wait for more data

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
