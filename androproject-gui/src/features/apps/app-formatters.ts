// ============================================================================
// ARCHIVO: app-formatters.ts
// QUÉ HACE: Utilidades puras de formateo, filtrado y ordenamiento para el
//           gestor de aplicaciones Android.
// CÓMO FUNCIONA: Funciones puras sin estado ni efectos secundarios.
// POR QUÉ: Separar utilidades de la UI bajo SRP y mantener archivos < 200 líneas.
// ============================================================================

import type { AppInfo } from '../types';

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

/** Filtra y ordena la lista de paquetes instalados según criterio activo. */
export function filterAndSortApps(
  appsList: AppInfo[],
  search: string,
  filter: string,
  sort: string,
): AppInfo[] {
  const q = search.toLowerCase();
  const filtered = appsList.filter((app) => {
    if (q && !app.name.toLowerCase().includes(q) && !app.packageName.toLowerCase().includes(q)) return false;
    if (filter === 'system') return app.isSystem || app.isBloatware;
    if (filter === 'user') return !app.isSystem;
    if (filter === 'hidden') return app.isHidden;
    if (filter === 'adware') return app.hasOverlay;
    if (filter === 'disabled') return app.isDisabled;
    if (filter === 'google') return app.isGoogle;
    if (filter === 'malware') return app.isMalware;
    if (filter === 'bloatware') return app.isBloatware;
    if (filter === 'safe') return app.safeToRemove;
    if (filter === 'critical') return app.criticalSystem;
    return true;
  });
  return filtered.sort((a, b) => {
    if (sort === 'name_asc') return a.name.localeCompare(b.name);
    if (sort === 'name_desc') return b.name.localeCompare(a.name);
    if (sort === 'date_desc') return (b.date || 0) - (a.date || 0);
    if (sort === 'date_asc') return (a.date || 0) - (b.date || 0);
    if (sort === 'size_desc') return (b.size || 0) - (a.size || 0);
    if (sort === 'size_asc') return (a.size || 0) - (b.size || 0);
    return 0;
  });
}
