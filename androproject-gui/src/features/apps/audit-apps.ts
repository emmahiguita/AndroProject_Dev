// ============================================================================
// ARCHIVO: apps/audit-apps.ts
// QUÉ HACE: Ejecuta la auditoría heurística real de virus/spyware contra
//           `/api/security-scan` y fusiona los hallazgos en `AppInfo[]`.
// CÓMO FUNCIONA: Consulta el endpoint nativo Rust por `serial`, indexa cada
//           `SpywareFinding` por `packageName` y marca `isMalware`, `hasOverlay`,
//           `isHidden` y `threatName` en la lista actual del catálogo.
// POR QUÉ: Mantener `AppsView.tsx` < 200 líneas aplicando SRP sin duplicar lógica.
// ============================================================================
import { apiUrl } from '@/lib/api-url';
import { rustBridge } from '@/lib/services/tauri-bridge';
import type { AppInfo } from '../types';
import type { SpywareFinding } from '../security-types';

export type PkgAction = 'uninstall' | 'disable' | 'enable' | 'force_stop' | 'clear_data' | 'launch' | 'extract_apk';

/** Ejecuta una acción ADB sobre un paquete usando Tauri nativo o el servidor Rust embebido. */
export async function executeAppPkgAction(
  serial: string,
  pkgName: string,
  action: PkgAction,
): Promise<{ ok: boolean; message: string }> {
  if (action !== 'extract_apk' && rustBridge.isDesktop() && serial !== 'Hardware Level') {
    const rustOut = await rustBridge.appActionFast(serial, pkgName, action);
    if (rustOut !== null && !/Failure|Exception|Error:|No activities found/i.test(rustOut)) {
      const msg = action === 'launch' && rustOut.trim() ? rustOut.trim() : `[Nativo] ${action} → ${pkgName} completado.`;
      return { ok: true, message: msg };
    }
    return { ok: false, message: `No se pudo completar ${action} para ${pkgName}: ${rustOut || 'sin respuesta del servicio nativo'}` };
  }
  const res = await fetch(apiUrl('/api/apps'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action, packageName: pkgName, serial,
      confirmed: ['uninstall', 'disable', 'clear_data'].includes(action),
    }),
  });
  const data = await res.json();
  if (data.success) return { ok: true, message: data.message || `Acción ${action} aplicada a ${pkgName}.` };
  return { ok: false, message: `Error (${action} en ${pkgName}): ${data.error || 'fallo ADB'}` };
}

export interface AuditAppsResult {
  ok: boolean;
  error?: string;
  scannedCount: number;
  findingsCount: number;
  updatedApps: AppInfo[];
}

export async function runAppsVirusAudit(serial: string, appsList: AppInfo[]): Promise<AuditAppsResult> {
  const res = await fetch(apiUrl(`/api/security-scan?serial=${encodeURIComponent(serial)}`));
  const data = await res.json();
  if (!data.success) {
    return { ok: false, error: data.error || 'Error al ejecutar la auditoría de seguridad.', scannedCount: 0, findingsCount: 0, updatedApps: appsList };
  }
  const findings: SpywareFinding[] = Array.isArray(data.findings) ? data.findings : [];
  const byPkg = new Map(findings.map((f) => [f.packageName, f]));
  const updatedApps = appsList.map((app) => {
    const hit = byPkg.get(app.packageName);
    if (!hit) return { ...app, isMalware: false, hasOverlay: false, isHidden: false, threatName: undefined };
    return {
      ...app,
      isMalware: hit.severity === 'critical' || hit.severity === 'high',
      hasOverlay: hit.hasOverlay,
      isHidden: hit.isHidden,
      threatName: `${hit.category.toUpperCase()} (${hit.score} pts)`,
    };
  });
  return { ok: true, scannedCount: Number(data.scannedCount ?? 0), findingsCount: findings.length, updatedApps };
}
