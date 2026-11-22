// ============================================================================
// ARCHIVO: route.ts (apps)
// QUÉ HACE: Expone `POST /api/apps` para listar, desinstalar, deshabilitar,
//           habilitar, detener o purgar datos de paquetes Android vía ADB.
// CÓMO FUNCIONA: Valida `serial` y `packageName`, bloquea desinstalación o
//           deshabilitación de paquetes críticos del sistema (`403`), aplica
//           timeouts de 15s y verifica `Failure`/`Exception` en `stdout`.
// POR QUÉ: Delegar catálogo y listado mantiene este archivo < 140 líneas (SRP)
//           y evita falsos positivos o soft-bricks en paquetes críticos.
// ============================================================================

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';
import { assertValidPackageName, isValidDeviceSerial } from '@/lib/security/input-sanitizer';
import { isCriticalSystem } from './_lib/app-catalog';
import { listDeviceApps } from './_lib/app-list-builder';

const execAsyncOrig = promisify(exec);
const execAsync = async (command: string, options: { timeout?: number; encoding?: BufferEncoding; maxBuffer?: number } = {}) => {
  const res = await execAsyncOrig(command, { encoding: 'utf8', timeout: 15000, ...options, windowsHide: true });
  return {
    stdout: typeof res.stdout === 'string' ? res.stdout : (res.stdout ? String(res.stdout) : ''),
    stderr: typeof res.stderr === 'string' ? res.stderr : (res.stderr ? String(res.stderr) : ''),
  };
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const SYSTEM_PARTITIONS = ['/system/', '/system_ext/', '/product/', '/vendor/', '/apex/'];

function checkAdbFailure(stdout: string, fallbackMsg: string): NextResponse | null {
  if (/Failure|Exception|Error:/i.test(stdout)) {
    return NextResponse.json({ success: false, error: stdout.trim() || fallbackMsg }, { status: 422 });
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { action, packageName, serial } = await req.json();

    const { stdout: devicesOut } = await execAsync(`"${ADB}" devices`, { timeout: 5000 });
    const detectedId = devicesOut.split('\n').slice(1).find((l: string) => l.includes('\tdevice'))?.split(/\s+/)[0];
    const targetSerial = serial || detectedId;

    if (!targetSerial) {
      return NextResponse.json({ success: false, error: 'Dispositivo no detectado' }, { status: 400 });
    }
    if (targetSerial !== 'Hardware Level' && !isValidDeviceSerial(targetSerial)) {
      return NextResponse.json({ success: false, error: 'Serial de dispositivo inválido' }, { status: 400 });
    }

    const adbTarget = targetSerial !== 'Hardware Level' ? `"${ADB}" -s ${targetSerial}` : `"${ADB}"`;

    if (action === 'list') {
      const apps = await listDeviceApps(adbTarget, execAsync);
      return NextResponse.json({ success: true, apps });
    }

    let safePkg = '';
    try {
      safePkg = assertValidPackageName(packageName);
    } catch (err) {
      return NextResponse.json({ success: false, error: getErrorMessage(err) }, { status: 400 });
    }

    if (action === 'uninstall') {
      if (isCriticalSystem(safePkg)) {
        return NextResponse.json({ success: false, error: `Paquete crítico del sistema protegido: ${safePkg}` }, { status: 403 });
      }
      const { stdout: pathCheck } = await execAsync(`${adbTarget} shell pm path ${safePkg}`, { timeout: 6000 }).catch(() => ({ stdout: '' }));
      const isSystem = SYSTEM_PARTITIONS.some((dir) => pathCheck.includes(dir));
      const cmd = isSystem
        ? `${adbTarget} shell pm uninstall -k --user 0 ${safePkg}`
        : `${adbTarget} shell pm uninstall ${safePkg}`;
      const { stdout } = await execAsync(cmd);
      const fail = checkAdbFailure(stdout, `No se pudo desinstalar ${safePkg}`);
      if (fail) return fail;
      return NextResponse.json({
        success: true,
        message: isSystem ? `Aplicación de fábrica ${safePkg} desinstalada de forma segura.` : `Aplicación ${safePkg} desinstalada correctamente.`,
      });
    }

    if (action === 'disable') {
      if (isCriticalSystem(safePkg)) {
        return NextResponse.json({ success: false, error: `Paquete crítico del sistema protegido: ${safePkg}` }, { status: 403 });
      }
      const { stdout } = await execAsync(`${adbTarget} shell pm disable-user --user 0 ${safePkg}`);
      const fail = checkAdbFailure(stdout, `No se pudo deshabilitar ${safePkg}`);
      if (fail) return fail;
      return NextResponse.json({ success: true, message: `Aplicación ${safePkg} deshabilitada correctamente.` });
    }

    if (action === 'enable') {
      const { stdout } = await execAsync(`${adbTarget} shell pm enable ${safePkg}`);
      const fail = checkAdbFailure(stdout, `No se pudo habilitar ${safePkg}`);
      if (fail) return fail;
      return NextResponse.json({ success: true, message: `Aplicación ${safePkg} habilitada y lista para usar.` });
    }

    if (action === 'force_stop') {
      await execAsync(`${adbTarget} shell am force-stop ${safePkg}`);
      return NextResponse.json({ success: true, message: `Proceso de ${safePkg} detenido inmediatamente.` });
    }

    if (action === 'clear_data') {
      const { stdout } = await execAsync(`${adbTarget} shell pm clear ${safePkg}`);
      const fail = checkAdbFailure(stdout, `No se pudieron purgar los datos de ${safePkg}`);
      if (fail) return fail;
      return NextResponse.json({ success: true, message: `Datos y caché de ${safePkg} purgados.` });
    }

    return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[Apps API] Error:', getErrorMessage(error));
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
