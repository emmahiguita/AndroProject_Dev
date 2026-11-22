// ============================================================================
// ARCHIVO: actions/apps.ts
// QUÉ HACE: Endpoints de listado de paquetes (`listApps`) y procesos activos
//           en ejecución (`listRunning`) para `/api/actions`.
// CÓMO FUNCIONA: Delega `listApps` al motor unificado de alta velocidad
//           `listDeviceApps` (`~350ms` con caché de 30s) eliminando el bucle
//           secuencial antiguo que ejecutaba 1,200 comandos ADB.
// POR QUÉ: Unificar la fuente de verdad de aplicaciones (con detección real de
//          malware, adware, overlay y tamaño) y mantener < 100 líneas (SRP).
// ============================================================================

import { NextResponse } from 'next/server';
import { safeExec, execAsync } from './_lib/helpers';
import { ActionContext } from './_lib/context';
import { listDeviceApps } from '@/app/api/apps/_lib/app-list-builder';

/** Lista los procesos de aplicaciones que están corriendo actualmente en RAM. */
export async function listRunning(ctx: ActionContext) {
  try {
    const { out: psOut } = await safeExec(
      `${ctx.adbTarget} shell "dumpsys activity processes | grep -E 'proc #|ProcessRecord|processName=' | head -40"`,
      8000,
    );

    let packages: string[] = [];

    if (psOut && psOut.includes('processName=')) {
      const matches = psOut.match(/processName=([^\s\n]+)/g) || [];
      packages = matches
        .map((m) => m.replace('processName=', '').trim())
        .filter((p) => p.includes('.') && !p.startsWith('['));
    } else {
      const { out: psFallback } = await safeExec(
        `${ctx.adbTarget} shell "ps -A 2>/dev/null | tail -n +2 | awk '{print $NF}' | head -40"`,
        8000,
      );
      packages = (psFallback || '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 3 && l.includes('.'));
    }

    const unique = [...new Set(packages)]
      .filter((p) => !p.startsWith('[') && p.length > 3)
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      running: unique,
      total: unique.length,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Error listando procesos en ejecución',
      running: [],
      total: 0,
    });
  }
}

/** Lista todas las aplicaciones instaladas usando el motor unificado en lote. */
export async function listApps(ctx: ActionContext) {
  try {
    const apps = await listDeviceApps(ctx.adbTarget, execAsync, false);
    return NextResponse.json({ success: true, apps });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Error al listar aplicaciones',
    });
  }
}
