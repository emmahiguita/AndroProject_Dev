// ============================================================================
// ARCHIVO: /api/drivers/route.ts
// QUÉ HACE: Endpoint GET/POST del DriverManager de Windows (diagnóstico PnPUtil,
//           cruce ADB/Fastboot, verificación `.cat` e instalación `.inf`).
// CÓMO FUNCIONA: Delega las operaciones reales a `driver-manager.ts` con
//           validación estricta de rutas y acciones.
// POR QUÉ: Exponer gestión profesional de drivers USB Windows sin simulaciones.
// ============================================================================
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  scanWindowsDrivers,
  verifyCatalogSignature,
  installInfDriver,
} from '@/lib/services/driver-manager';

export async function GET() {
  try {
    const report = await scanWindowsDrivers();
    return NextResponse.json({ success: true, ...report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, filePath } = (await req.json()) as { action?: 'verify_cat' | 'install_inf'; filePath?: string };
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ success: false, error: 'Ruta de archivo requerida.' }, { status: 400 });
    }
    if (action === 'verify_cat') {
      const sig = await verifyCatalogSignature(filePath);
      return NextResponse.json({ success: sig.valid, ...sig, message: `Firma .cat: ${sig.status}` });
    }
    if (action === 'install_inf') {
      const res = await installInfDriver(filePath);
      return NextResponse.json(res);
    }
    return NextResponse.json({ success: false, error: 'Acción no reconocida.' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
