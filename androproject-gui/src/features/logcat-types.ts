// ============================================================================
// ARCHIVO: logcat-types.ts
// QUÉ HACE: Define la interfaz compartida `LogcatEntry` para el visor Logcat.
// CÓMO FUNCIONA: Expone tipos puros desacoplados de `src/app/api/*`.
// POR QUÉ: Permitir exportación estática pura sin acoplamiento al backend Node.js.
// ============================================================================

export interface LogcatEntry {
  id: string;
  timestamp: string;
  pid: string;
  tid: string;
  level: 'V' | 'D' | 'I' | 'W' | 'E' | 'F' | 'S';
  tag: string;
  message: string;
  raw: string;
  isCrash?: boolean;
  isAppSwitch?: boolean;
  packageName?: string;
  activityName?: string;
}
