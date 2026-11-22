/**
 * ServiceContainer — Type-safe Inversion of Control (IoC) Dependency Injection Container.
 * SOLID Principles:
 *   - DIP: High-level application modules depend on abstractions (ports/tokens), not concrete classes.
 *   - SRP: Manages service resolution, singleton lifecycle, and factory bindings.
 */

export type ServiceFactory<T> = (container: ServiceContainer) => T;

export class ServiceContainer {
  private static instance: ServiceContainer | null = null;
  private services = new Map<string, unknown>();
  private factories = new Map<string, ServiceFactory<unknown>>();
  private singletons = new Set<string>();

  public static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
      initializeDefaultBindings(ServiceContainer.instance);
    }
    return ServiceContainer.instance;
  }

  /** Register a transient service factory (new instance on every resolve) */
  public registerTransient<T>(token: string, factory: ServiceFactory<T>): this {
    this.factories.set(token, factory as ServiceFactory<unknown>);
    this.singletons.delete(token);
    this.services.delete(token);
    return this;
  }

  /** Register a singleton service (resolved once and cached) */
  public registerSingleton<T>(token: string, factory: ServiceFactory<T>): this {
    this.factories.set(token, factory as ServiceFactory<unknown>);
    this.singletons.add(token);
    this.services.delete(token);
    return this;
  }

  /** Register an already instantiated singleton instance */
  public registerInstance<T>(token: string, instance: T): this {
    this.services.set(token, instance);
    this.singletons.add(token);
    return this;
  }

  /** Resolve a service by token */
  public resolve<T>(token: string): T {
    if (this.services.has(token)) {
      return this.services.get(token) as T;
    }

    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`[ServiceContainer] Service not registered for token: "${token}"`);
    }

    const resolved = factory(this) as T;
    if (this.singletons.has(token)) {
      this.services.set(token, resolved);
    }
    return resolved;
  }

  /** Check if a service token is registered */
  public has(token: string): boolean {
    return this.services.has(token) || this.factories.has(token);
  }

  /** Clear all registrations (useful for unit tests) */
  public reset(): void {
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
  }
}

// Well-known Service Tokens
export const TOKENS = {
  AdbExecutor: 'IAdbExecutor',
  ScrcpyTransport: 'IScrcpyTransport',
  AirPlayEngine: 'IAirPlayEngine',
  AirPlayTransport: 'IAirPlayTransport',
  IosBridge: 'IIosBridge',
  ProjectionCoordinator: 'IProjectionCoordinator',
  SessionManager: 'ISessionManager',
} as const;

export type ServiceToken = typeof TOKENS[keyof typeof TOKENS];

/**
 * Initializes default bindings into the container.
 * Uses lazy imports / factories so circular dependencies and heavy imports are avoided.
 */
function initializeDefaultBindings(c: ServiceContainer): void {
  // ADB Executor
  c.registerSingleton(TOKENS.AdbExecutor, () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { adb } = require('@/lib/services/adb-executor');
    return adb;
  });

  // Scrcpy Transport
  c.registerSingleton(TOKENS.ScrcpyTransport, () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { scrcpyTransport } = require('@/core/transports/ScrcpyStreamTransport');
    return scrcpyTransport;
  });

  // AirPlay Engine
  c.registerSingleton(TOKENS.AirPlayEngine, () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { airPlayReceiverEngine } = require('@/lib/services/airplay-engine');
    return airPlayReceiverEngine;
  });

  // AirPlay Transport
  c.registerSingleton(TOKENS.AirPlayTransport, () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { airPlayTransport } = require('@/core/transports/AirPlayStreamTransport');
    return airPlayTransport;
  });

  // iOS Automation & WDA Bridge
  c.registerSingleton(TOKENS.IosBridge, () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { iosBridge } = require('@/lib/services/ios-bridge');
    return iosBridge;
  });

  // Projection Coordinator
  c.registerSingleton(TOKENS.ProjectionCoordinator, () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { projectionCoordinator } = require('@/lib/services/projection-coordinator');
    return projectionCoordinator;
  });
}

export const container = ServiceContainer.getInstance();
