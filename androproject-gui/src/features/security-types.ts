// ============================================================================
// ARCHIVO: security-types.ts
// QUÉ HACE: Define los contratos TypeScript de diagnósticos USB (`DriverScanReport`)
//           y auditoría anti-spyware (`SpywareFinding`) consumidos por el UI.
// CÓMO FUNCIONA: Expone tipos puros desacoplados del backend 100% Rust.
// POR QUÉ: Eliminar cualquier resto de servicios Node.js en `src/lib/` (< 200L).
// ============================================================================

export interface WindowsUsbEntry {
  instanceId: string;
  description: string;
  className: string;
  driverInf: string;
  status: string;
  problemCode: string;
  hardwareId: string;
}

export interface DriverScanReport {
  mobileUsb: WindowsUsbEntry[];
  mobileProblems: WindowsUsbEntry[];
  otherProblemsCount: number;
  adbDevices: string[];
  fastbootDevices: string[];
}

export interface SpywareFinding {
  packageName: string;
  severity: 'critical' | 'high' | 'medium';
  category: 'spyware' | 'adware' | 'trojan';
  score: number;
  installer: string;
  hasOverlay: boolean;
  hasAccessibility?: boolean;
  hasNotificationAccess?: boolean;
  hasInstallPackages?: boolean;
  isDeviceAdmin?: boolean;
  isHidden: boolean;
  reasons: string[];
}
