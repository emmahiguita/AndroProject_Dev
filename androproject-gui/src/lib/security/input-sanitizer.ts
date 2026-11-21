// ============================================================================
// ARCHIVO: input-sanitizer.ts
// QUÉ HACE: Valida y sanea parámetros críticos (seriales ADB y package names)
//           antes de interpolarlos en comandos shell/ADB.
// CÓMO FUNCIONA: Aplica listas blancas estrictas por expresión regular (allowlist)
//           para impedir inyección de comandos (;&|`$<>).
// POR QUÉ: Cerrar vulnerabilidades críticas de Command Injection en endpoints API.
// ============================================================================

const PACKAGE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/;
const SERIAL_RE = /^[a-zA-Z0-9._:-]{1,128}$/;

/** Verifica que un nombre de paquete Android cumpla el formato oficial seguro. */
export function isValidPackageName(pkg: unknown): pkg is string {
  return typeof pkg === 'string' && pkg.length <= 200 && PACKAGE_NAME_RE.test(pkg.trim());
}

/** Verifica que un serial ADB (USB o IP:puerto) no contenga metacaracteres shell. */
export function isValidDeviceSerial(serial: unknown): serial is string {
  return typeof serial === 'string' && SERIAL_RE.test(serial.trim());
}

/** Devuelve el packageName limpio o lanza error si es malicioso/inválido. */
export function assertValidPackageName(pkg: unknown): string {
  if (!isValidPackageName(pkg)) {
    throw new Error('Nombre de paquete inválido o inseguro');
  }
  return pkg.trim();
}

/** Devuelve el serial limpio o lanza error si es malicioso/inválido. */
export function assertValidDeviceSerial(serial: unknown): string {
  if (!isValidDeviceSerial(serial)) {
    throw new Error('Serial de dispositivo inválido o inseguro');
  }
  return serial.trim();
}
