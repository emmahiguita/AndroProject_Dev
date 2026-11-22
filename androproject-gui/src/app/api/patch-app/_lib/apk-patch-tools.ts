// ============================================================================
// ARCHIVO: apk-patch-tools.ts
// QUÉ HACE: Utilidades de extracción, restauración de APK original, inyección
//           LSPatch, alineación `zipalign` y firmado `apksigner` con timeouts.
// CÓMO FUNCIONA: Limpia artefactos previos, extrae splits por `adb pull` en
//           paralelo, restaura `assets/lspatch/origin.apk` si ya fue curado,
//           ejecuta LSPatch, Zipalign (4 bytes) y Apksigner con timeouts acotados.
// POR QUÉ: Separar el pipeline binario mantiene `patch-app/route.ts` < 200L
//           (SRP) y evita procesos colgados sin timeout.
// ============================================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { ANDROPROJECT_HOME } from '@/lib/config';

const execAsyncOrig = promisify(exec);

export const execPatchCmd = async (
  command: string,
  options: { timeout?: number; encoding?: BufferEncoding; maxBuffer?: number } = {},
) => {
  const res = await execAsyncOrig(command, {
    encoding: 'utf8',
    timeout: 120_000,
    ...options,
    windowsHide: true,
  });
  return {
    stdout: typeof res.stdout === 'string' ? res.stdout : (res.stdout ? String(res.stdout) : ''),
    stderr: typeof res.stderr === 'string' ? res.stderr : (res.stderr ? String(res.stderr) : ''),
  };
};

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const TOOLS_DIR = path.join(ANDROPROJECT_HOME, 'tools');
const LSPATCH_DIR = path.join(TOOLS_DIR, 'lspatch');
export const LSPATCH_JAR = path.join(LSPATCH_DIR, 'lspatch.jar');
export const MODULE_APK = path.join(LSPATCH_DIR, 'DisableFlagSecure.apk');
const ZIPALIGN_EXE = path.join(TOOLS_DIR, 'zipalign.exe');
const APKSIGNER_JAR = path.join(TOOLS_DIR, 'apksigner.jar');
const KEYSTORE_FILE = path.join(TOOLS_DIR, 'debug.keystore');
export const TEMP_DIR = path.join(ANDROPROJECT_HOME, 'temp');
export const LOG_FILE = path.join(TEMP_DIR, 'patch.log');

export async function appendPatchLog(msg: string) {
  try {
    await fs.promises.appendFile(LOG_FILE, `[${new Date().toLocaleTimeString()}] ${msg}\n`);
  } catch {}
}

export async function cleanTempPackageFiles(packageName: string) {
  await fs.promises.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});
  const existing = await fs.promises.readdir(TEMP_DIR);
  await Promise.all(
    existing
      .filter((f) => f.startsWith(`${packageName}_`))
      .map(async (f) => {
        const fullPath = path.join(TEMP_DIR, f);
        const stat = await fs.promises.stat(fullPath).catch(() => null);
        if (!stat) return;
        if (stat.isDirectory()) await fs.promises.rm(fullPath, { recursive: true, force: true }).catch(() => {});
        else await fs.promises.unlink(fullPath).catch(() => {});
      }),
  );
}

export async function pullAndRestoreApks(
  adbTarget: string,
  packageName: string,
  apkPaths: string[],
  tempExtractDirs: string[],
): Promise<string[]> {
  const localApks = await Promise.all(
    apkPaths.map(async (devicePath, i) => {
      const fileName = devicePath.split('/').pop() || `split_${i}.apk`;
      const localPath = path.join(TEMP_DIR, `${packageName}_${fileName}`);
      await execPatchCmd(`${adbTarget} pull "${devicePath}" "${localPath}"`, { timeout: 90_000 });
      return localPath;
    }),
  );

  await appendPatchLog('Analizando integridad de las partes extraidas...');
  await Promise.all(
    localApks.map(async (localPath, i) => {
      const tempDir = path.join(TEMP_DIR, `extract_${path.basename(localPath)}_${Date.now()}_${i}`);
      tempExtractDirs.push(tempDir);
      try {
        const { stdout } = await execPatchCmd(`tar -tf "${localPath}" assets/lspatch/origin.apk`, { timeout: 15_000 });
        if (!stdout.includes('assets/lspatch/origin.apk')) return;
        await appendPatchLog(`Restaurando version pura detectada en ${path.basename(localPath)}...`);
        await fs.promises.mkdir(tempDir, { recursive: true });
        await execPatchCmd(`tar -xf "${localPath}" -C "${tempDir}" assets/lspatch/origin.apk`, { timeout: 30_000 });
        const origin = path.join(tempDir, 'assets', 'lspatch', 'origin.apk');
        if (fs.existsSync(origin)) await fs.promises.copyFile(origin, localPath);
      } catch { /* No estaba parcheado previamente */ }
    }),
  );

  return localApks;
}

export async function runLspatchAlignAndSign(localApks: string[], packageName: string): Promise<string[]> {
  await appendPatchLog('Inyectando Modulo de Seguridad y curando codigo...');
  const apkArgs = localApks.map((p) => `"${p}"`).join(' ');
  await execPatchCmd(`java -jar "${LSPATCH_JAR}" ${apkArgs} -m "${MODULE_APK}" -o "${TEMP_DIR}" -f -l 2`, {
    maxBuffer: 50 * 1024 * 1024,
    timeout: 180_000,
  });
  await appendPatchLog('Inyeccion LSPatch Completada.');

  const postFiles = await fs.promises.readdir(TEMP_DIR);
  const patchedApks = postFiles
    .filter((f) => f.startsWith(`${packageName}_`) && f.endsWith('.apk') && f.includes('lspatch'))
    .map((f) => path.join(TEMP_DIR, f));
  if (patchedApks.length === 0) throw new Error('No se generaron APKs parcheados.');

  if (fs.existsSync(ZIPALIGN_EXE)) {
    await appendPatchLog('Aplicando Alineacion Geometrica (Zipalign a 4 bytes)...');
    await Promise.all(
      patchedApks.map(async (apkPath) => {
        const aligned = apkPath.replace('.apk', '-aligned.apk');
        await execPatchCmd(`"${ZIPALIGN_EXE}" -p -f 4 "${apkPath}" "${aligned}"`, { timeout: 60_000 });
        await fs.promises.unlink(apkPath);
        await fs.promises.rename(aligned, apkPath);
      }),
    );
  } else {
    await appendPatchLog('AVISO: zipalign.exe no encontrado en tools. Android 11+ podria rechazar la instalacion.');
  }

  if (fs.existsSync(APKSIGNER_JAR) && fs.existsSync(KEYSTORE_FILE)) {
    await appendPatchLog('Firmando digitalmente los App Bundles...');
    await Promise.all(
      patchedApks.map((apkPath) =>
        execPatchCmd(`java -jar "${APKSIGNER_JAR}" sign --ks "${KEYSTORE_FILE}" --ks-pass pass:android "${apkPath}"`, { timeout: 60_000 }),
      ),
    );
  } else {
    await appendPatchLog('AVISO: apksigner.jar o debug.keystore no encontrados.');
  }

  return patchedApks;
}
