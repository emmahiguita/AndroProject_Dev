// ============================================================================
// ARCHIVO: /api/security-scan/route.ts
// QUÉ HACE: Endpoint GET que ejecuta el escáner heurístico real de spyware/adware
//           sobre el dispositivo Android conectado vía ADB.
// CÓMO FUNCIONA: Valida el serial, rechaza seriales iOS (no aplica ADB) e invoca
//           `scanDeviceForSpyware(serial)` sin modificar archivos del teléfono.
// POR QUÉ: Exponer detección real por permisos/accesibilidad/sideload (< 200L).
// ============================================================================
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isValidDeviceSerial } from '@/lib/security/input-sanitizer';
import { scanDeviceForSpyware } from '@/lib/services/spyware-heuristic-scanner';

export async function GET(req: NextRequest) {
  const serial = req.nextUrl.searchParams.get('serial') || '';
  if (!serial || serial.startsWith('apple-') || serial.startsWith('airplay-')) {
    return NextResponse.json({
      success: false,
      findings: [],
      scannedThirdParty: 0,
      accessibilityCount: 0,
      error: 'El escaneo heurístico de paquetes aplica solo a dispositivos Android vía ADB.',
    });
  }
  if (!isValidDeviceSerial(serial)) {
    return NextResponse.json({ success: false, error: 'Serial de dispositivo inválido.' }, { status: 400 });
  }

  try {
    const result = await scanDeviceForSpyware(serial);
    return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
