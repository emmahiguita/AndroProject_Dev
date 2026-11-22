// ============================================================================
// ARCHIVO: route.ts (apps)
// QUÉ HACE: Expone `POST /api/apps` para listar, abrir (`launch`), detener
//           (`force_stop`), limpiar datos (`clear_data`), extraer APK a PC
//           (`extract_apk`), habilitar, deshabilitar o desinstalar paquetes.
// CÓMO FUNCIONA: Evita ejecutar `adb devices` redundante cuando el frontend ya
//           envía `serial`, usa la caché de 30s de `listDeviceApps` e invalida
//           dicha caché automáticamente al modificar paquetes.
// POR QUÉ: Acelerar drásticamente la respuesta del módulo Aplicaciones (< 165L).
// ============================================================================

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { ADB, ANDROPROJECT_HOME } from '@/lib/config';
import { assertValidPackageName, isValidDeviceSerial } from '@/lib/security/input-sanitizer';
import { isCriticalSystem } from './_lib/app-catalog';
import { listDeviceApps, invalidateAppListCache } from './_lib/app-list-builder';
import { launchDevicePackage } from './_lib/app-launcher';

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
  if (/Failure|Exception|Error:|No activities found/i.test(stdout)) {
    return NextResponse.json({ success: false, error: stdout.trim() || fallbackMsg }, { status: 422 });
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { action, packageName, serial, forceRefresh } = await req.json();

    let targetSerial = serial && serial !== 'Hardware Level' ? String(serial).trim() : '';
    if (!targetSerial) {
      const { stdout: devicesOut } = await execAsync(`"${ADB}" devices`, { timeout: 4000 });
      targetSerial = devicesOut.split('\n').slice(1).find((l: string) => l.includes('\tdevice'))?.split(/\s+/)[0] || '';
    }

    if (!targetSerial) {
      return NextResponse.json({ success: false, error: 'Dispositivo no detectado' }, { status: 400 });
    }
    if (!isValidDeviceSerial(targetSerial)) {
      return NextResponse.json({ success: false, error: 'Serial de dispositivo inválido' }, { status: 400 });
    }

    const adbTarget = `"${ADB}" -s ${targetSerial}`;

    if (action === 'list') {
      const apps = await listDeviceApps(adbTarget, execAsync, Boolean(forceRefresh));
      return NextResponse.json({ success: true, apps });
    }

    let safePkg = '';
    try {
      safePkg = assertValidPackageName(packageName);
    } catch (err) {
      return NextResponse.json({ success: false, error: getErrorMessage(err) }, { status: 400 });
    }

    if (action === 'launch') {
      const result = await launchDevicePackage(adbTarget, safePkg, execAsync);
      return NextResponse.json(
        {
          success: result.success,
          message: result.message,
          error: result.error,
          openedSettings: result.openedSettings,
        },
        { status: result.status },
      );
    }

    if (action === 'force_stop') {
      await execAsync(`${adbTarget} shell am force-stop ${safePkg}`);
      return NextResponse.json({ success: true, message: `Proceso de ${safePkg} detenido inmediatamente.` });
    }

    if (action === 'clear_data') {
      if (isCriticalSystem(safePkg)) {
        return NextResponse.json({ success: false, error: `Paquete crítico protegido: ${safePkg}` }, { status: 403 });
      }
      const { stdout } = await execAsync(`${adbTarget} shell pm clear ${safePkg}`);
      const fail = checkAdbFailure(stdout, `No se pudieron purgar los datos de ${safePkg}`);
      if (fail) return fail;
      return NextResponse.json({ success: true, message: `Datos y caché de ${safePkg} purgados correctamente.` });
    }

    if (action === 'extract_apk') {
      const { stdout: pathOut } = await execAsync(`${adbTarget} shell pm path ${safePkg}`, { timeout: 8000 });
      const apkLines = pathOut
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/^package:/, ''))
        .filter((l) => l.endsWith('.apk'));
      const remotePath = apkLines.find((l) => l.endsWith('/base.apk')) || apkLines[0];
      if (!remotePath || !/^[a-zA-Z0-9/_.~=@+-]+\.apk$/.test(remotePath)) {
        return NextResponse.json({ success: false, error: `No se encontró la ruta APK de ${safePkg}` }, { status: 404 });
      }
      const backupDir = path.join(ANDROPROJECT_HOME, 'backups', 'apks');
      await fs.promises.mkdir(backupDir, { recursive: true });
      const destFile = path.join(backupDir, `${safePkg}.apk`);
      await execAsync(`${adbTarget} pull "${remotePath}" "${destFile}"`, { timeout: 30000 });
      return NextResponse.json({
        success: true,
        path: destFile,
        message: `APK respaldado en PC: ${destFile}`,
      });
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
      invalidateAppListCache(adbTarget);
      return NextResponse.json({
        success: true,
        message: isSystem ? `App de fábrica ${safePkg} desinstalada para el usuario actual.` : `Aplicación ${safePkg} desinstalada.`,
      });
    }

    if (action === 'disable') {
      if (isCriticalSystem(safePkg)) {
        return NextResponse.json({ success: false, error: `Paquete crítico del sistema protegido: ${safePkg}` }, { status: 403 });
      }
      const { stdout } = await execAsync(`${adbTarget} shell pm disable-user --user 0 ${safePkg}`);
      const fail = checkAdbFailure(stdout, `No se pudo deshabilitar ${safePkg}`);
      if (fail) return fail;
      invalidateAppListCache(adbTarget);
      return NextResponse.json({ success: true, message: `Aplicación ${safePkg} deshabilitada.` });
    }

    if (action === 'enable') {
      const { stdout } = await execAsync(`${adbTarget} shell pm enable ${safePkg}`);
      const fail = checkAdbFailure(stdout, `No se pudo habilitar ${safePkg}`);
      if (fail) return fail;
      invalidateAppListCache(adbTarget);
      return NextResponse.json({ success: true, message: `Aplicación ${safePkg} habilitada.` });
    }

    return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[Apps API] Error:', getErrorMessage(error));
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
