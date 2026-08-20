/**
 * Services barrel export.
 * SOLID: DIP — consumers import from here, never from concrete implementations.
 */
export type { IAdbExecutor, AdbExecResult } from './adb-executor';
export { AdbExecutor, adb } from './adb-executor';
export type { IDeviceDetector, DetectedDevice } from './device-detector';
export { DeviceDetector } from './device-detector';
export type { IDeviceInfoFetcher, DeviceInfo } from './device-info-fetcher';
export { DeviceInfoFetcher } from './device-info-fetcher';
export type { IScreenCapture, CaptureResult } from './screen-capture';
export { ScreenCapture } from './screen-capture';
export type { IScrcpyManager, ScrcpyInstance, ScrcpyOptions } from './scrcpy-manager';
export { ScrcpyManager } from './scrcpy-manager';
