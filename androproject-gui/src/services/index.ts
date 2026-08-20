// ── Service layer exports ───────────────────────────────────────
// Interfaces define contracts for dependency injection.
// AdbCommandExecutor provides a real + mock implementation for ICommandExecutor.
export { AdbCommandExecutor, MockCommandExecutor } from './AdbCommandExecutor';
export type { ICommandExecutor, CommandResult, AdbConfig } from './types';
export type {
  IDeviceService, IAdbCommandExecutor, INetworkRadarService,
} from './contracts';
