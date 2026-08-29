/**
 * ProjectionCoordinator — Multi-Platform Unified Projection Dispatcher
 *
 * DIP / OCP: Routes projection requests to either VisionNanoEngine (Android)
 * or AirPlayReceiverEngine (iOS Apple AirPlay) based on device.platform.
 */

import { visionNanoEngine, VisionNanoOptions, VisionNanoResult } from './scrcpy-engine';
import { airPlayReceiverEngine, AirPlayServerOptions } from './airplay-engine';
import type { DeviceInfo, AirPlayServerStatus } from '@/features/types';

export interface ProjectionLaunchOptions extends VisionNanoOptions {
  platform?: 'android' | 'ios';
  airplayOptions?: Partial<AirPlayServerOptions>;
}

export class ProjectionCoordinator {
  /**
   * Starts screen projection for the specified target device (Android or iOS).
   */
  public async start(device: DeviceInfo, options: ProjectionLaunchOptions): Promise<VisionNanoResult | AirPlayServerStatus> {
    const isIos = device.platform === 'ios' || device.serial.startsWith('airplay-');

    if (isIos) {
      console.log(`[Projection Coordinator] Iniciando sesión AirPlay para ${device.model}`);
      return await airPlayReceiverEngine.start(options.airplayOptions);
    }

    console.log(`[Projection Coordinator] Iniciando VisionNano Direct3D11 para ${device.model} (${device.serial})`);
    return await visionNanoEngine.start({
      ...options,
      serial: device.serial,
    });
  }

  /**
   * Stops screen projection for the specified target device.
   */
  public async stop(device: DeviceInfo): Promise<boolean> {
    const isIos = device.platform === 'ios' || device.serial.startsWith('airplay-');

    if (isIos) {
      console.log(`[Projection Coordinator] Deteniendo sesión AirPlay para ${device.model}`);
      return await airPlayReceiverEngine.stop();
    }

    console.log(`[Projection Coordinator] Deteniendo VisionNano para ${device.serial}`);
    return await visionNanoEngine.stop(device.serial);
  }

  /**
   * Checks if projection is actively running for the specified device.
   */
  public async isAlive(device: DeviceInfo): Promise<boolean> {
    const isIos = device.platform === 'ios' || device.serial.startsWith('airplay-');

    if (isIos) {
      const status = await airPlayReceiverEngine.getStatus();
      return status.running;
    }

    return await visionNanoEngine.checkAlive(device.serial);
  }
}

export const projectionCoordinator = new ProjectionCoordinator();
