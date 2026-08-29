/**
 * Device Stream API - Optimized MJPEG streaming endpoint
 * 
 * Architecture (SOLID principles applied):
 * - BinaryResolver: Binary path resolution with caching
 * - StreamManager: Pipeline lifecycle management
 * - MjpegFrameHandler: Efficient frame parsing and broadcasting
 * 
 * Performance optimizations:
 * - Cached binary resolution (5 min cache)
 * - Pre-allocated buffers for frame parsing
 * - Direct client iteration without Array.from
 * - Silent logging in hot paths
 * - Efficient process cleanup
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ReadableStream } from 'stream/web';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';
import { StreamManager, StreamConfig } from '@/lib/services/stream-manager';
import { BinaryResolver } from '@/lib/services/binary-resolver';
import { Buffer } from 'buffer';
import { MjpegFrameHandler } from '@/lib/services/mjpeg-frame-handler';

const execAsync = promisify(exec);

// Initialize binary paths on module load
const SCRCPY_PATH = BinaryResolver.resolveScrcpy();
const FFMPEG_PATH = BinaryResolver.resolveFfmpeg();
console.log(`[device-stream] scrcpy: ${SCRCPY_PATH}`);
console.log(`[device-stream] ffmpeg: ${FFMPEG_PATH}`);

// Placeholder frame for errors
function placeholderFrame(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0x10, 0x10, 0x10, 0x18,
    0x00, 0x00, 0x06, 0x00, 0x01, 0x59, 0x27, 0xC5,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82,
  ]);
}

async function captureScreenshot(serial: string): Promise<Uint8Array | null> {
  try {
    const { stdout } = await execAsync(
      `"${ADB}" -s ${serial} exec-out screencap -p`,
      { timeout: 10000, encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 },
    ) as { stdout: Buffer };
    
    if (stdout.length > 1000 && stdout[0] === 0x89 && stdout[1] === 0x50) {
      return new Uint8Array(stdout.buffer, stdout.byteOffset, stdout.byteLength);
    }
  } catch {}
  return null;
}

function createMjpegStream(
  frameHandler: MjpegFrameHandler,
  serial: string
): ReadableStream {
  let streamController: ReadableStreamDefaultController | null = null;
  return new ReadableStream({
    start(controller) {
      streamController = controller;
      frameHandler.addClient(controller);
      // Send initial boundary
      controller.enqueue(Buffer.from('--frame\r\nContent-Type: image/jpeg\r\n\r\n'));
    },
    cancel() {
      if (streamController) {
        frameHandler.removeClient(streamController);
      }
      if (frameHandler.getClientCount() === 0) {
        StreamManager.cleanup(serial);
      }
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serial = searchParams.get('serial');
  const mode = searchParams.get('mode') || 'mjpeg';
  const maxSize = searchParams.get('maxSize') || '1080';
  const maxFps = searchParams.get('maxFps') || '30';
  const bitRate = searchParams.get('bitRate') || '8M';

  if (!serial) {
    return new NextResponse(placeholderFrame() as unknown as BodyInit, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    });
  }

  // MJPEG streaming mode
  if (mode === 'mjpeg' || mode === 'auto') {
    try {
      const config: StreamConfig = {
        serial,
        maxSize,
        maxFps,
        bitRate,
      };

      const frameHandler = StreamManager.create(config);
      if (!frameHandler) {
        throw new Error('Failed to create stream handler');
      }

      const stream = createMjpegStream(frameHandler, serial);
      
      return new Response(stream as unknown as BodyInit, {
        headers: {
          'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Connection': 'keep-alive',
          'X-Frame-Mode': 'scrcpy-mjpeg',
          'X-Connection': 'ok',
          'X-Accel-Buffering': 'no', // Disable nginx buffering for real-time streaming
        },
      });
    } catch (err) {
      console.error(`[device-stream] MJPEG start failed for ${serial}:`, err);
    }
  }

  // Screenshot fallback
  const frame = await captureScreenshot(serial);
  if (frame) {
    return new NextResponse(frame as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Frame-Mode': 'screenshot',
        'X-Connection': 'ok',
      },
    });
  }

  // Error fallback
  return new NextResponse(placeholderFrame() as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'X-Frame-Error': 'capture-failed',
      'X-Connection': 'disconnected',
    },
  });
}
