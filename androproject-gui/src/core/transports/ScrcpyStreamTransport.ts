/**
 * ScrcpyStreamTransport — Android Hardware Accelerated Video Stream Transport
 *
 * SOLID Principles:
 *   - SRP: Manages exclusively the low-level lifecycle of Scrcpy projection streams.
 *   - LSP: Fully substitutable implementation of IStreamTransport for Android devices.
 *   - DIP: Depends on IScrcpyEngine abstraction.
 */

import type { IStreamTransport, StreamSessionConfig, StreamSessionResult } from '../domain/ports/IStreamTransport';
import { visionNanoEngine, type IVisionNanoEngine } from '@/lib/services/scrcpy-engine';

export class ScrcpyStreamTransport implements IStreamTransport {
  public readonly protocol = 'scrcpy-native' as const;

  constructor(private readonly engine: IVisionNanoEngine = visionNanoEngine) {}

  public async start(config: StreamSessionConfig): Promise<StreamSessionResult> {
    try {
      const result = await this.engine.start({
        serial: config.serial,
        displayId: config.displayId,
        maxSize: config.maxSize,
        maxFps: config.maxFps,
        bitRate: config.bitRate,
        turnScreenOff: config.turnScreenOff,
        stayAwake: config.stayAwake,
        alwaysOnTop: config.alwaysOnTop,
        borderless: config.borderless,
        videoSource: config.videoSource,
      });

      return {
        success: result.success,
        alive: result.alive,
        sessionId: config.serial,
        pid: result.pid,
        message: result.message,
        error: result.error,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        alive: false,
        sessionId: config.serial,
        error: message,
      };
    }
  }

  public async stop(sessionId: string): Promise<boolean> {
    return this.engine.stop(sessionId);
  }

  public async isAlive(sessionId: string): Promise<boolean> {
    return this.engine.checkAlive(sessionId);
  }
}

export const scrcpyTransport = new ScrcpyStreamTransport();
