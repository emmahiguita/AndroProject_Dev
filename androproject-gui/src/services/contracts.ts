import { DeviceInfo, SystemLogs, QuickActionItem, AppPackage } from '../features/types';

export interface IDeviceService {
  getDevices(): Promise<DeviceInfo[]>;
  getDeviceDetails(serial: string): Promise<DeviceInfo | null>;
  rebootDevice(serial: string, mode?: 'normal' | 'bootloader' | 'recovery' | 'poweroff'): Promise<boolean>;
  takeScreenshot(serial: string): Promise<string | null>;
  startScreenRecord(serial: string): Promise<boolean>;
  stopScreenRecord(serial: string): Promise<string | null>;
}

export interface IAdbCommandExecutor {
  executeCommand(serial: string, command: string): Promise<{ success: boolean; output: string }>;
  installApk(serial: string, apkPath: string): Promise<{ success: boolean; message: string }>;
  uninstallApp(serial: string, packageName: string): Promise<{ success: boolean; message: string }>;
  pushFile(serial: string, localPath: string, remotePath: string): Promise<{ success: boolean; message: string }>;
}

export interface INetworkRadarService {
  scanSubnet(): Promise<string[]>;
  connectWireless(ip: string, port?: number): Promise<boolean>;
  disconnectWireless(ip: string, port?: number): Promise<boolean>;
}
