// ============================================================================
// ARCHIVO: route.ts (patch-app)
// QUÉ HACE: Expone `POST /api/patch-app` para leer el log de curado o parchar
//           e instalar una app Android (modo normal o clon aislado) vía LSPatch.
// CÓMO FUNCIONA: Valida `packageName` y `serial` (`400`), delega extracción,
//           parcheo, zipalign y firmado a `_lib/apk-patch-tools.ts`, instala
//           verificando `Failure` y limpia temporales en `finally`.
// POR QUÉ: Mantener este endpoint < 140 líneas (SRP) con timeouts seguros.
// ============================================================================

import { NextResponse } from 'next/server';
import fs from 'fs';
import { ADB } from '@/lib/config';
import { assertValidDeviceSerial } from '@/lib/security/input-sanitizer';
import {
  LOG_FILE,
  LSPATCH_JAR,
  MODULE_APK,
  appendPatchLog,
  cleanTempPackageFiles,
  execPatchCmd,
  getErrorMessage,
  pullAndRestoreApks,
  runLspatchAlignAndSign,
} from './_lib/apk-patch-tools';

const isValidPackageName = (pkg: string) => /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(pkg);
const isValidSerial = (serial: string) => /^[A-Za-z0-9._:-]+$/.test(serial);

export async function POST(request: Request) {
  let localApks: string[] = [];
  let patchedApks: string[] = [];
  const tempExtractDirs: string[] = [];

  try {
    const { action, packageName, serial, isClone } = await request.json();

    if (action === 'get_log') {
      const log = await fs.promises.readFile(LOG_FILE, 'utf8').catch(() => '');
      return NextResponse.json({ log });
    }
    if (action !== 'patch_app') {
      return NextResponse.json({ success: false, error: 'Accion no valida' }, { status: 400 });
    }
    if (!packageName || typeof packageName !== 'string' || !isValidPackageName(packageName)) {
      return NextResponse.json({ success: false, error: 'Nombre de paquete inválido' }, { status: 400 });
    }
    if (serial && (typeof serial !== 'string' || !isValidSerial(serial))) {
      return NextResponse.json({ success: false, error: 'Identificador de dispositivo inválido' }, { status: 400 });
    }

    await cleanTempPackageFiles(packageName);
    await fs.promises.writeFile(LOG_FILE, `Iniciando proceso PROFESIONAL de Curado para: ${packageName}\n`);

    if (!fs.existsSync(LSPATCH_JAR) || !fs.existsSync(MODULE_APK)) {
      await appendPatchLog('ERROR FATAL: Faltan los motores LSPatch en C:\\AndroProject\\tools\\lspatch.');
      return NextResponse.json({ success: false, error: 'Herramientas LSPatch no encontradas' }, { status: 500 });
    }

    const safeSerial = serial ? assertValidDeviceSerial(serial) : '';
    const adbTarget = safeSerial ? `"${ADB}" -s ${safeSerial}` : `"${ADB}"`;

    await appendPatchLog('Escaneando particiones del dispositivo (Buscando App Bundles)...');
    const { stdout: pathOut } = await execPatchCmd(`${adbTarget} shell pm path ${packageName}`, { timeout: 10_000 })
      .catch(() => ({ stdout: '' }));
    const apkPaths = pathOut.split('\n').filter((l) => l.includes('package:')).map((l) => l.replace('package:', '').trim());
    if (apkPaths.length === 0) {
      await appendPatchLog('ERROR: La aplicacion no esta instalada en el dispositivo.');
      return NextResponse.json({ success: false, error: 'Aplicacion no instalada' }, { status: 404 });
    }

    await appendPatchLog(apkPaths.length > 1 ? `App Bundle Complejo detectado (${apkPaths.length} partes).` : 'APK Monolitico detectado.');
    await appendPatchLog('Extrayendo codigo fuente original...');
    localApks = await pullAndRestoreApks(adbTarget, packageName, apkPaths, tempExtractDirs);
    patchedApks = await runLspatchAlignAndSign(localApks, packageName);

    const installPaths = patchedApks.map((p) => `"${p}"`).join(' ');
    const installBase = patchedApks.length === 1 ? 'install' : 'install-multiple';

    if (isClone) {
      await appendPatchLog('Modo CLON activado. Buscando perfil secundario aislado...');
      let targetUser = '10';
      try {
        const { stdout: usersOut } = await execPatchCmd(`${adbTarget} shell pm list users`, { timeout: 10_000 });
        const secondary = Array.from(usersOut.matchAll(/UserInfo\{(\d+):/g)).find((m) => m[1] !== '0');
        if (secondary?.[1]) { targetUser = secondary[1]; await appendPatchLog(`Perfil aislado detectado: ID ${targetUser}`); }
      } catch {}
      const { stdout: cloneOut } = await execPatchCmd(`${adbTarget} ${installBase} --user ${targetUser} ${installPaths}`, { maxBuffer: 50 * 1024 * 1024, timeout: 180_000 });
      if (/Failure|Exception/i.test(cloneOut)) throw new Error(cloneOut.trim());
      await appendPatchLog(`Clon instalado exitosamente en el perfil ${targetUser}.`);
    } else {
      await appendPatchLog('Desinstalando versión original (Liberando candados)...');
      await execPatchCmd(`${adbTarget} uninstall ${packageName}`, { timeout: 30_000 }).catch(() => {});
      await appendPatchLog('Instalando aplicación curada...');
      const { stdout: instOut } = await execPatchCmd(`${adbTarget} ${installBase} -r ${installPaths}`, { maxBuffer: 50 * 1024 * 1024, timeout: 180_000 });
      if (/Failure|Exception/i.test(instOut)) throw new Error(instOut.trim());
      await appendPatchLog('Despliegue finalizado con éxito.');
    }

    await appendPatchLog('¡PROCESO PROFESIONAL COMPLETADO EXITOSAMENTE!');
    return NextResponse.json({ success: true, message: 'Aplicacion curada y lista.' });
  } catch (err: unknown) {
    await appendPatchLog(`ERROR CRITICO: ${getErrorMessage(err)}`);
    return NextResponse.json({ success: false, error: getErrorMessage(err) }, { status: 500 });
  } finally {
    await appendPatchLog('Ejecutando limpieza de archivos temporales...');
    for (const p of localApks) await fs.promises.unlink(p).catch(() => {});
    for (const p of patchedApks) await fs.promises.unlink(p).catch(() => {});
    for (const d of tempExtractDirs) await fs.promises.rm(d, { recursive: true, force: true }).catch(() => {});
  }
}
