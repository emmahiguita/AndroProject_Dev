/**
 * AirPlayStreamTransport — Apple iOS Native AirPlay 2 Mirroring Stream Transport
 *
 * SOLID Principles:
 *   - SRP: Manages exclusively the low-level lifecycle of iOS AirPlay projection streams.
 *   - LSP: Fully substitutable implementation of IStreamTransport for iOS Apple devices.
 *   - DIP: Depends on IAirPlayReceiverEngine abstraction.
 */

import type { IStreamTransport, StreamSessionConfig, StreamSessionResult } from '../domain/ports/IStreamTransport';
import { airPlayReceiverEngine, type IAirPlayReceiverEngine } from '@/lib/services/airplay-engine';

export class AirPlayStreamTransport implements IStreamTransport {
  public readonly protocol = 'airplay' as const;

  constructor(private readonly engine: IAirPlayReceiverEngine = airPlayReceiverEngine) {}

  public async start(config: StreamSessionConfig): Promise<StreamSessionResult> {
    try {
      const status = await this.engine.start({
        serverName: config.windowTitle || 'AndroProject [PC]',
        maxFps: typeof config.maxFps === 'number' ? config.maxFps : 60,
      });

      return {
        success: status.running,
        alive: status.running,
        sessionId: config.serial || 'airplay-ios',
        streamUrl: `rtsp://0.0.0.0:${status.port}`,
        message: status.running ? 'Receptor AirPlay 2 activo para iOS' : 'No se pudo iniciar el servidor AirPlay',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        alive: false,
        sessionId: config.serial || 'airplay-ios',
        error: message,
      };
    }
  }

  public async stop(_sessionId: string): Promise<boolean> {
    return this.engine.stop();
  }

  public async isAlive(_sessionId: string): Promise<boolean> {
    const status = await this.engine.getStatus();
    return status.running;
  }
}

export const airPlayTransport = new AirPlayStreamTransport();
