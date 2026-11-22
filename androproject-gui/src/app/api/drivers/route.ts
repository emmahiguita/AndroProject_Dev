// ============================================================================
// ARCHIVO: /api/drivers/route.ts
// QUÉ HACE: Endpoint GET/POST del DriverManager de Windows con validación de
//           origen local (solo localhost/127.0.0.1) para operaciones elevadas.
// CÓMO FUNCIONA: GET escanea dispositivos USB/PnP/ADB/Fastboot; POST valida
//           el host/origen antes de verificar `.cat` o instalar `.inf`.
// POR QUÉ: Proteger operaciones PnPUtil/UAC contra llamadas externas no autorizadas.
// ============================================================================
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  scanWindowsDrivers,
  verifyCatalogSignature,
  installInfDriver,
} from '@/lib/services/driver-manager';

function isLocalAuthorizedRequest(req: NextRequest): boolean {
  const host = req.headers.get('host') || '';
  const origin = req.headers.get('origin') || '';
  const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  const isLocalOrigin = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  return isLocalHost && isLocalOrigin;
}

export async function GET() {
  try {
    const report = await scanWindowsDrivers();
    return NextResponse.json({ success: true, ...report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isLocalAuthorizedRequest(req)) {
    return NextResponse.json({ success: false, error: 'Operación restringida exclusivamente a origen local.' }, { status: 403 });
  }
  try {
    const { action, filePath } = (await req.json()) as { action?: 'verify_cat' | 'install_inf'; filePath?: string };
    if (!filePath || typeof filePath !== 'string' || filePath.includes('..')) {
      return NextResponse.json({ success: false, error: 'Ruta de archivo inválida.' }, { status: 400 });
    }
    if (action === 'verify_cat') {
      const sig = await verifyCatalogSignature(filePath);
      return NextResponse.json({ success: sig.valid, ...sig, message: `Firma .cat: ${sig.status}` });
    }
    if (action === 'install_inf') {
      const res = await installInfDriver(filePath);
      return NextResponse.json(res, { status: res.success ? 200 : 422 });
    }
    return NextResponse.json({ success: false, error: 'Acción no reconocida.' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
