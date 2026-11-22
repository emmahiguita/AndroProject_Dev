/**
 * ProjectionCoordinator — Multi-Platform Unified Projection Dispatcher
 *
 * SOLID Principles:
 *   - SRP: Exclusively orchestrates and routes projection sessions to appropriate stream transports.
 *   - OCP: Transports can be registered dynamically via registerTransport() without modifying this class.
 *   - LSP: Delegates uniformly to IStreamTransport implementations (Android, iOS, WebRTC, etc.).
 *   - DIP: Depends solely on the IStreamTransport abstraction, not concrete engines.
 */

import type { IStreamTransport, StreamSessionConfig, StreamSessionResult } from '@/core/domain/ports/IStreamTransport';
import { createSessionId, type DeviceSession } from '@/core/domain/entities/DeviceSession';
import { scrcpyTransport, ScrcpyStreamTransport } from '@/core/transports/ScrcpyStreamTransport';
import { airPlayTransport, AirPlayStreamTransport } from '@/core/transports/AirPlayStreamTransport';
import type { DeviceInfo, AirPlayServerStatus } from '@/features/types';
import type { VisionNanoOptions, VisionNanoResult } from './scrcpy-engine';
import type { AirPlayServerOptions } from './airplay-engine';

export interface ProjectionLaunchOptions extends VisionNanoOptions {
  platform?: 'android' | 'ios';
  airplayOptions?: Partial<AirPlayServerOptions>;
}

export interface IProjectionCoordinator {
  registerTransport(platform: string, transport: IStreamTransport): void;
  getTransport(platform: string): IStreamTransport | undefined;
  start(device: DeviceInfo, options?: ProjectionLaunchOptions): Promise<StreamSessionResult | VisionNanoResult | AirPlayServerStatus>;
  stop(device: DeviceInfo): Promise<boolean>;
  isAlive(device: DeviceInfo): Promise<boolean>;
  getActiveSessions(): DeviceSession[];
}

export class ProjectionCoordinator implements IProjectionCoordinator {
  private readonly transports = new Map<string, IStreamTransport>();
  private readonly sessions = new Map<string, DeviceSession>();

  constructor(customTransports?: Record<string, IStreamTransport>) {
    // Register default transports (DIP / OCP)
    this.registerTransport('android', scrcpyTransport);
    this.registerTransport('ios', airPlayTransport);

    if (customTransports) {
      for (const [platform, transport] of Object.entries(customTransports)) {
        this.registerTransport(platform, transport);
      }
    }
  }

  /**
   * Registers a new platform transport (OCP: open for extension without modifying class)
   */
  public registerTransport(platform: string, transport: IStreamTransport): void {
    this.transports.set(platform.toLowerCase(), transport);
  }

  /**
   * Resolves the appropriate transport for a given platform name
   */
  public getTransport(platform: string): IStreamTransport | undefined {
    return this.transports.get(platform.toLowerCase());
  }

  /**
   * Resolves the device platform identifier
   */
  private resolvePlatform(device: DeviceInfo, options?: ProjectionLaunchOptions): string {
    if (options?.platform) return options.platform.toLowerCase();
    if (device.platform === 'ios' || /^(airplay|apple)-/.test(device.serial)) return 'ios';
    return 'android';
  }

  /**
   * Starts screen projection for the specified target device (Android or iOS) polymorphically.
   */
  public async start(
    device: DeviceInfo,
    options: ProjectionLaunchOptions = { serial: device.serial }
  ): Promise<StreamSessionResult | VisionNanoResult | AirPlayServerStatus> {
    const platform = this.resolvePlatform(device, options);
    const transport = this.getTransport(platform);

    if (!transport) {
      throw new Error(`[ProjectionCoordinator] No transport registered for platform: "${platform}"`);
    }

    console.log(`[ProjectionCoordinator] Dispatching to ${transport.protocol} transport for ${device.model || device.serial} (${platform})`);

    const sessionConfig: StreamSessionConfig = {
      serial: device.serial,
      displayId: typeof options.displayId === 'string' ? parseInt(options.displayId, 10) || 0 : options.displayId,
      maxSize: options.maxSize,
      maxFps: options.maxFps,
      bitRate: options.bitRate,
      turnScreenOff: options.turnScreenOff,
      stayAwake: options.stayAwake,
      alwaysOnTop: options.alwaysOnTop,
      borderless: options.borderless,
      videoBuffer: options.videoBuffer,
      noAudio: options.noAudio,
      videoSource: options.videoSource,
      windowTitle: options.airplayOptions?.serverName || device.model,
    };

    const res = await transport.start(sessionConfig);
    if (!res.success || !res.alive) return res;
    const displayNum = typeof sessionConfig.displayId === 'number' ? sessionConfig.displayId : 0;
    const sessionId = createSessionId(device.serial, displayNum, options.videoSource || 'display');
    this.sessions.set(device.serial, {
      sessionId,
      serial: device.serial,
      displayId: displayNum,
      model: device.model || device.serial,
      platform: platform === 'ios' ? 'ios' : 'android',
      isStreaming: true,
      fps: Number(options.maxFps) || 60,
      mode: platform === 'ios' ? 'airplay' : 'scrcpy',
      startedAt: Date.now(),
      pid: 'pid' in res && typeof res.pid === 'number' ? res.pid : undefined,
    });
    return res;
  }

  /**
   * Stops screen projection for the specified target device polymorphically.
   */
  public async stop(device: DeviceInfo): Promise<boolean> {
    const platform = this.resolvePlatform(device);
    const transport = this.getTransport(platform);
    if (!transport) return false;

    console.log(`[ProjectionCoordinator] Stopping ${transport.protocol} transport for ${device.serial} (${platform})`);
    const stopped = await transport.stop(device.serial);
    if (!(await transport.isAlive(device.serial))) this.sessions.delete(device.serial);
    return stopped;
  }

  /**
   * Checks if projection is actively running for the specified device polymorphically.
   */
  public async isAlive(device: DeviceInfo): Promise<boolean> {
    const platform = this.resolvePlatform(device);
    const transport = this.getTransport(platform);

    if (!transport) return false;
    const alive = await transport.isAlive(device.serial);
    if (!alive) this.sessions.delete(device.serial);
    return alive;
  }

  public getActiveSessions(): DeviceSession[] {
    return Array.from(this.sessions.values());
  }
}

export { ScrcpyStreamTransport, AirPlayStreamTransport };
export const projectionCoordinator = new ProjectionCoordinator();
