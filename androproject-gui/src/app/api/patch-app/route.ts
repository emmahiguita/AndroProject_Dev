import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { ADB, ANDROPROJECT_HOME } from '@/lib/config';

const execAsync = promisify(exec);

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const isValidPackageName = (packageName: string) =>
  /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(packageName);

const isValidSerial = (serial: string) => /^[A-Za-z0-9._:-]+$/.test(serial);

const TOOLS_DIR = path.join(ANDROPROJECT_HOME, 'tools');
const LSPATCH_DIR = path.join(TOOLS_DIR, 'lspatch');
const LSPATCH_JAR = path.join(LSPATCH_DIR, 'lspatch.jar');
const MODULE_APK = path.join(LSPATCH_DIR, 'DisableFlagSecure.apk');

// Herramientas profesionales de sellado Android
const ZIPALIGN_EXE = path.join(TOOLS_DIR, 'zipalign.exe');
const APKSIGNER_JAR = path.join(TOOLS_DIR, 'apksigner.jar');
const KEYSTORE_FILE = path.join(TOOLS_DIR, 'debug.keystore');

const TEMP_DIR = path.join(ANDROPROJECT_HOME, 'temp');
const LOG_FILE = path.join(TEMP_DIR, 'patch.log');

async function appendLog(msg: string) {
  try {
    const timestamp = new Date().toLocaleTimeString();
    await fs.promises.appendFile(LOG_FILE, `[${timestamp}] ${msg}\n`);
  } catch {}
}

export async function POST(request: Request) {
  let localApks: string[] = [];
  let patchedApks: string[] = [];
  const tempExtractDirs: string[] = [];
  
  try {
    const { action, packageName, serial, isClone } = await request.json();
    
    if (action === 'get_log') {
      try {
        const logData = await fs.promises.readFile(LOG_FILE, 'utf8');
        return NextResponse.json({ log: logData });
      } catch {
        return NextResponse.json({ log: '' });
      }
    }

    if (action === 'patch_app') {
      if (!packageName) throw new Error('Paquete no especificado');
      if (typeof packageName !== 'string' || !isValidPackageName(packageName)) {
        throw new Error('Nombre de paquete inválido');
      }
      if (serial && (typeof serial !== 'string' || !isValidSerial(serial))) {
        throw new Error('Identificador de dispositivo inválido');
      }
      
      // 1. Inicializacion asincrona y Limpieza inicial
      await fs.promises.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});
      
      const existingFiles = await fs.promises.readdir(TEMP_DIR);
      const cleanOps = existingFiles.map(async (f) => {
        if (f.startsWith(`${packageName}_`)) {
          const fullPath = path.join(TEMP_DIR, f);
          const stat = await fs.promises.stat(fullPath);
          if (stat.isDirectory()) {
            await fs.promises.rm(fullPath, { recursive: true, force: true }).catch(() => {});
          } else {
            await fs.promises.unlink(fullPath).catch(() => {});
          }
        }
      });
      await Promise.all(cleanOps);

      await fs.promises.writeFile(LOG_FILE, `Iniciando proceso PROFESIONAL de Curado para: ${packageName}\n`);
      
      if (!fs.existsSync(LSPATCH_JAR) || !fs.existsSync(MODULE_APK)) {
        await appendLog('ERROR FATAL: Faltan los motores LSPatch en C:\\AndroProject\\tools\\lspatch.');
        throw new Error('Herramientas LSPatch no encontradas');
      }

      const adbTarget = serial ? `"${ADB}" -s ${serial}` : `"${ADB}"`;
      let apkPaths: string[] = [];
      let isSplit = false;

      // 2. Obtener rutas desde el dispositivo
      await appendLog('Escaneando particiones del dispositivo (Buscando App Bundles)...');
      try {
        const { stdout: pathOut } = await execAsync(`${adbTarget} shell pm path ${packageName}`);
        if (pathOut && pathOut.includes('package:')) {
          apkPaths = pathOut.split('\n')
            .filter(l => l.includes('package:'))
            .map(l => l.replace('package:', '').trim());
          isSplit = apkPaths.length > 1;
        }
      } catch (err: unknown) {
        await appendLog(`Aviso al escanear celular: ${getErrorMessage(err)}`);
      }

      if (apkPaths.length === 0) {
        await appendLog('ERROR: La aplicacion no esta instalada en el dispositivo.');
        throw new Error('Aplicacion no instalada');
      }

      await appendLog(isSplit ? `App Bundle Complejo detectado (${apkPaths.length} partes).` : 'APK Monolitico detectado.');
        
      // 3. Extraccion en PARALELO (Cuello de botella resuelto)
      await appendLog('Extrayendo codigo fuente original a maxima velocidad (Multihilo)...');
      const pullPromises = apkPaths.map(async (devicePath, i) => {
        const fileName = devicePath.split('/').pop() || `split_${i}.apk`;
        const localPath = path.join(TEMP_DIR, `${packageName}_${fileName}`);
        await execAsync(`${adbTarget} pull "${devicePath}" "${localPath}"`);
        return localPath;
      });
      
      localApks = await Promise.all(pullPromises);

      // 4. Verificacion de curados previos (Evita bucles infinitos de firma)
      await appendLog('Analizando integridad de las partes extraidas...');
      const extractPromises = localApks.map(async (localPath, i) => {
        const fileName = path.basename(localPath);
        const tempExtractDir = path.join(TEMP_DIR, `extract_${fileName}_${Date.now()}_${i}`);
        tempExtractDirs.push(tempExtractDir);
        
        try {
          const { stdout } = await execAsync(`tar -tf "${localPath}" assets/lspatch/origin.apk`);
          if (stdout && stdout.includes('assets/lspatch/origin.apk')) {
            await appendLog(`Restaurando version pura detectada en ${fileName}...`);
            await fs.promises.mkdir(tempExtractDir, { recursive: true });
            await execAsync(`tar -xf "${localPath}" -C "${tempExtractDir}" assets/lspatch/origin.apk`);
            const extractedOrigin = path.join(tempExtractDir, 'assets', 'lspatch', 'origin.apk');
            if (fs.existsSync(extractedOrigin)) {
              await fs.promises.copyFile(extractedOrigin, localPath);
            }
          }
        } catch {
          // No estaba parcheado previamente
        }
      });
      await Promise.all(extractPromises);

      // 5. Inyeccion LSPatch (Motor Principal optimizado)
      await appendLog('Inyectando Modulo de Seguridad y curando codigo...');
      const apkArgs = localApks.map(p => `"${p}"`).join(' ');
      
      // buffer de 50MB y modo local (-l 2) para saltar detecciones anti-tamper
      try {
        await execAsync(`java -jar "${LSPATCH_JAR}" ${apkArgs} -m "${MODULE_APK}" -o "${TEMP_DIR}" -f -l 2`, { maxBuffer: 50 * 1024 * 1024 });
        await appendLog('Inyeccion LSPatch Completada.');
      } catch (err: unknown) {
        await appendLog(`ERROR de inyeccion: ${getErrorMessage(err)}`);
        throw new Error('Fallo al inyectar el modulo LSPatch');
      }

      const filesPostPatch = await fs.promises.readdir(TEMP_DIR);
      patchedApks = filesPostPatch
        .filter(f => f.startsWith(`${packageName}_`) && f.endsWith('.apk') && f.includes('lspatch'))
        .map(f => path.join(TEMP_DIR, f));
      
      if (patchedApks.length === 0) throw new Error('No se generaron APKs parcheados.');

      // 6. Alineacion Matematica (Zipalign) - CRITICO PARA ANDROID 11+
      const hasZipalign = fs.existsSync(ZIPALIGN_EXE);
      const hasSigner = fs.existsSync(APKSIGNER_JAR) && fs.existsSync(KEYSTORE_FILE);
      
      if (hasZipalign) {
        await appendLog('Aplicando Alineacion Geometrica (Zipalign a 4 bytes)...');
        const zipalignPromises = patchedApks.map(async (apkPath) => {
          const alignedPath = apkPath.replace('.apk', '-aligned.apk');
          await execAsync(`"${ZIPALIGN_EXE}" -p -f 4 "${apkPath}" "${alignedPath}"`);
          await fs.promises.unlink(apkPath); 
          await fs.promises.rename(alignedPath, apkPath); 
        });
        await Promise.all(zipalignPromises);
      } else {
        await appendLog('AVISO: zipalign.exe no encontrado en tools. Android 11+ podria rechazar la instalacion.');
      }

      // 7. Re-Firmado Criptografico (Apksigner)
      if (hasSigner) {
        await appendLog('Firmando digitalmente los App Bundles para asegurar la cadena de confianza...');
        const signPromises = patchedApks.map(async (apkPath) => {
          await execAsync(`java -jar "${APKSIGNER_JAR}" sign --ks "${KEYSTORE_FILE}" --ks-pass pass:android "${apkPath}"`);
        });
        await Promise.all(signPromises);
      } else {
        await appendLog('AVISO: apksigner.jar o debug.keystore no encontrados. Usando firma de depuracion estandar.');
      }

      // 8. Instalacion Inteligente
      if (isClone) {
        await appendLog('Modo CLON activado. Instalando en el perfil de trabajo paralelo...');
        try {
          const installPaths = patchedApks.map(p => `"${p}"`).join(' ');
          await execAsync(`${adbTarget} install-multiple --user 10 ${installPaths}`, { maxBuffer: 50 * 1024 * 1024 });
          await appendLog('Clon instalado exitosamente en el perfil aislado.');
        } catch (e: unknown) {
          await appendLog(`Error creando el clon (¿Perfil 10 existe?): ${getErrorMessage(e)}`);
          throw new Error('Fallo al clonar en el perfil secundario');
        }
      } else {
        await appendLog('Desinstalando version bloqueada original (Liberando candados)...');
        await execAsync(`${adbTarget} uninstall ${packageName}`).catch(() => {});
        
        await appendLog('Instalando Arquitectura Curada...');
        const installPaths = patchedApks.map(p => `"${p}"`).join(' ');
        await execAsync(`${adbTarget} install-multiple ${installPaths}`, { maxBuffer: 50 * 1024 * 1024 });
        await appendLog(`Despliegue finalizado con exito.`);
      }
      
      await appendLog('¡PROCESO PROFESIONAL COMPLETADO EXITOSAMENTE!');
      
      return NextResponse.json({ success: true, message: 'Aplicacion curada y lista.' });
    }

    return NextResponse.json({ success: false, error: 'Accion no valida' });

  } catch (err: unknown) {
    await appendLog(`ERROR CRITICO: ${getErrorMessage(err)}`);
    return NextResponse.json({ success: false, error: getErrorMessage(err) });
  } finally {
    // 9. Garbage Collection (Recolector de Basura a prueba de fallos)
    try {
      await appendLog('Ejecutando limpieza de archivos temporales...');
      for (const p of localApks) await fs.promises.unlink(p).catch(() => {});
      for (const p of patchedApks) await fs.promises.unlink(p).catch(() => {});
      for (const d of tempExtractDirs) await fs.promises.rm(d, { recursive: true, force: true }).catch(() => {});
    } catch {}
  }
}
