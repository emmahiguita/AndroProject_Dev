// ============================================================================
// ARCHIVO: app-formatters.ts
// QUÉ HACE: Utilidades puras de formateo para el gestor de aplicaciones
//           (tamaños en bytes, fechas legibles y extracción segura de errores).
// CÓMO FUNCIONA: Funciones puras sin estado ni efectos secundarios.
// POR QUÉ: Separar utilidades de la UI bajo SRP y mantener archivos < 200 líneas.
// ============================================================================

/** Convierte un tamaño en bytes a una cadena legible (B, KB, MB, GB). */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Formatea una marca de tiempo Unix (ms) a fecha corta en español. */
export function formatDate(timestamp: number): string {
  if (!timestamp || timestamp === 0) return '--';
  return new Date(timestamp).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Extrae el mensaje legible de cualquier valor lanzado en bloques catch. */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
