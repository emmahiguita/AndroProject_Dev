/**
 * Core Domain & Infrastructure barrel export
 *
 * SOLID Principles:
 *   - DIP: High-level modules import ports, entities, and container tokens from here.
 *   - OCP: Open to new transports and services.
 */

// Ports & Contracts
export type {
  IStreamTransport,
  StreamSessionConfig,
  StreamSessionResult,
  ISessionManager,
} from './domain/ports/IStreamTransport';

export type { IAirPlayReceiverEngine } from '@/lib/services/airplay-engine';
export type { IScrcpyEngine } from '@/lib/services/scrcpy-engine';
export type { IIosBridge, IosDeviceInfo, IosWdaStatus } from '@/lib/services/ios-bridge';
export { iosBridge } from '@/lib/services/ios-bridge';

// Domain Entities
export {
  createSessionId,
  type DeviceSession,
} from './domain/entities/DeviceSession';

// Container & IoC
export {
  ServiceContainer,
  TOKENS,
  container,
  type ServiceFactory,
  type ServiceToken,
} from './container/ServiceContainer';

// Concrete Transports
export {
  ScrcpyStreamTransport,
  scrcpyTransport,
} from './transports/ScrcpyStreamTransport';

export {
  AirPlayStreamTransport,
  airPlayTransport,
} from './transports/AirPlayStreamTransport';
