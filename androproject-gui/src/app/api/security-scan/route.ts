// ============================================================================
// ARCHIVO: /api/security-scan/route.ts
// QUÉ HACE: Endpoint GET/POST para auditoría heurística de adware/spyware y
//           remediación inmediata sin root (revocar overlay, force-stop, disable).
// CÓMO FUNCIONA: Valida serial y nombre de paquete contra inyección, ejecuta
//           `scanDeviceForSpyware(serial)` en GET y comandos `appops`/`am`/`pm`
//           en POST.
// POR QUÉ: Detectar y neutralizar publicidad invasiva y spyware real (< 200L).
// ============================================================================
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';
import { assertValidPackageName, isValidDeviceSerial } from '@/lib/security/input-sanitizer';
import { scanDeviceForSpyware } from '@/lib/services/spyware-heuristic-scanner';

const execFileAsync = promisify(execFile);

export async function GET(req: NextRequest) {
  const serial = req.nextUrl.searchParams.get('serial') || '';
  if (!serial || serial.startsWith('apple-') || serial.startsWith('airplay-')) {
    return NextResponse.json({
      success: false, findings: [], scannedThirdParty: 0, accessibilityCount: 0, topWindowPkg: null,
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
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { serial, packageName, action } = (await req.json()) as {
      serial?: string; packageName?: string; action?: 'revoke_overlay' | 'force_stop' | 'disable';
    };
    if (!serial || !isValidDeviceSerial(serial)) {
      return NextResponse.json({ success: false, error: 'Serial inválido.' }, { status: 400 });
    }
    const pkg = assertValidPackageName(packageName);

    const shellArgs =
      action === 'revoke_overlay' ? ['appops', 'set', pkg, 'SYSTEM_ALERT_WINDOW', 'ignore']
        : action === 'force_stop' ? ['am', 'force-stop', pkg]
          : action === 'disable' ? ['pm', 'disable-user', '--user', '0', pkg]
            : null;

    if (!shellArgs) {
      return NextResponse.json({ success: false, error: 'Acción de remediación no soportada.' }, { status: 400 });
    }

    await execFileAsync(ADB, ['-s', serial, 'shell', ...shellArgs], { timeout: 8000, windowsHide: true });
    const label = action === 'revoke_overlay' ? 'Overlay/anuncios bloqueados'
      : action === 'force_stop' ? 'Proceso detenido'
        : 'Aplicación deshabilitada';
    return NextResponse.json({ success: true, message: `${label}: ${pkg}` });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
