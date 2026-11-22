// ============================================================================
// ARCHIVO: /api/security-scan/route.ts
// QUÉ HACE: Endpoint GET/POST para auditoría heurística de adware/spyware y
//           remediación inmediata sin root (revocar overlay, accesibilidad,
//           notificaciones, instalación APK, force-stop, disable y suspend).
// CÓMO FUNCIONA: Valida serial y nombre de paquete contra inyección, ejecuta
//           `scanDeviceForSpyware(serial)` en GET y comandos `appops`/`settings`/
//           `am`/`pm` en POST.
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

export type RemediationAction =
  | 'revoke_overlay'
  | 'revoke_install_packages'
  | 'revoke_accessibility'
  | 'revoke_notifications'
  | 'force_stop'
  | 'disable'
  | 'enable'
  | 'suspend'
  | 'unsuspend';

export async function GET(req: NextRequest) {
  const serial = req.nextUrl.searchParams.get('serial') || '';
  if (!serial || serial.startsWith('apple-') || serial.startsWith('airplay-')) {
    return NextResponse.json({
      success: false, findings: [], scannedThirdParty: 0, accessibilityCount: 0, hiddenAppsCount: 0, topWindowPkg: null,
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

const PROTECTED_SYSTEM_PKGS = new Set([
  'android', 'com.android.systemui', 'com.android.settings', 'com.android.phone', 'com.android.shell',
]);

async function removePackageFromColonSetting(serial: string, key: string, pkg: string): Promise<string> {
  const { stdout } = await execFileAsync(ADB, ['-s', serial, 'shell', 'settings', 'get', 'secure', key], {
    timeout: 6000, windowsHide: true,
  });
  const current = (stdout || '').trim();
  if (!current || current === 'null') return 'Sin entradas activas';
  const remaining = current
    .split(':')
    .map((e) => e.trim())
    .filter((e) => e && !e.startsWith(`${pkg}/`));
  if (remaining.length === 0) {
    await execFileAsync(ADB, ['-s', serial, 'shell', 'settings', 'delete', 'secure', key], { timeout: 6000, windowsHide: true });
  } else {
    await execFileAsync(ADB, ['-s', serial, 'shell', 'settings', 'put', 'secure', key, remaining.join(':')], {
      timeout: 6000, windowsHide: true,
    });
  }
  return 'Permiso revocado en settings secure';
}

export async function POST(req: NextRequest) {
  try {
    const { serial, packageName, action } = (await req.json()) as {
      serial?: string; packageName?: string; action?: RemediationAction;
    };
    if (!serial || !isValidDeviceSerial(serial)) {
      return NextResponse.json({ success: false, error: 'Serial inválido.' }, { status: 400 });
    }
    const pkg = assertValidPackageName(packageName);
    if (PROTECTED_SYSTEM_PKGS.has(pkg) && (action === 'suspend' || action === 'disable')) {
      return NextResponse.json({ success: false, error: `Paquete crítico protegido: ${pkg}` }, { status: 400 });
    }

    if (action === 'revoke_accessibility') {
      const out = await removePackageFromColonSetting(serial, 'enabled_accessibility_services', pkg);
      return NextResponse.json({ success: true, message: `Accesibilidad revocada: ${pkg}`, output: out });
    }
    if (action === 'revoke_notifications') {
      const out = await removePackageFromColonSetting(serial, 'enabled_notification_listeners', pkg);
      return NextResponse.json({ success: true, message: `Lectura de notificaciones revocada: ${pkg}`, output: out });
    }

    const shellArgs =
      action === 'revoke_overlay' ? ['appops', 'set', pkg, 'SYSTEM_ALERT_WINDOW', 'ignore']
        : action === 'revoke_install_packages' ? ['appops', 'set', pkg, 'REQUEST_INSTALL_PACKAGES', 'ignore']
          : action === 'force_stop' ? ['am', 'force-stop', pkg]
            : action === 'disable' ? ['pm', 'disable-user', '--user', '0', pkg]
              : action === 'enable' ? ['pm', 'enable', pkg]
                : action === 'suspend' ? ['pm', 'suspend', pkg]
                  : action === 'unsuspend' ? ['pm', 'unsuspend', pkg]
                    : null;

    if (!shellArgs) {
      return NextResponse.json({ success: false, error: 'Acción de remediación no soportada.' }, { status: 400 });
    }

    const { stdout, stderr } = await execFileAsync(ADB, ['-s', serial, 'shell', ...shellArgs], { timeout: 8000, windowsHide: true });
    const out = `${stdout || ''}\n${stderr || ''}`.trim();
    if (/exception|error|failed|not allowed|securityexception/i.test(out)) {
      return NextResponse.json({ success: false, error: out }, { status: 422 });
    }
    const labels: Record<string, string> = {
      revoke_overlay: 'Overlay/anuncios bloqueados',
      revoke_install_packages: 'Instalación de APKs bloqueada',
      force_stop: 'Proceso detenido',
      suspend: 'App congelada sin perder datos',
      unsuspend: 'App descongelada',
      disable: 'Aplicación deshabilitada',
      enable: 'Aplicación habilitada',
    };
    return NextResponse.json({ success: true, message: `${(action && labels[action]) || 'Acción aplicada'}: ${pkg}`, output: out });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
