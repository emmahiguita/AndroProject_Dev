// ============================================================================
// ARCHIVO: apk-icon-extractor.ts
// QUÉ HACE: Extrae iconos reales (PNG/WebP) directamente desde los APKs
//           instalados en el dispositivo Android conectado y los cachea en disco.
// CÓMO FUNCIONA: Consulta `adb shell pm path <pkg>`, prioriza el split DPI
//           ligero (< 2MB) o `base.apk`, extrae el mejor `ic_launcher` con
//           Python `zipfile` y limpia el archivo temporal en `finally`.
// POR QUÉ: Mostrar iconos auténticos incluso en apps de sistema, OEM o
//           sideloaded sin depender de Play Store ni saturar memoria.
// ============================================================================

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ADB } from '@/lib/config';
import { assertValidPackageName, isValidDeviceSerial } from '@/lib/security/input-sanitizer';

const execFileAsync = promisify(execFile);
const CACHE_DIR = path.join(process.cwd(), '.cache', 'app-icons');
const MAX_APK_BYTES = 35 * 1024 * 1024; // Evitar descargar APKs masivos (>35MB) por USB

export interface CachedIcon {
  buffer: Buffer;
  contentType: 'image/png' | 'image/webp';
}

/** Lee un icono ya cacheado en disco si existe (latencia < 2ms). */
export async function readCachedIcon(pkg: string): Promise<CachedIcon | null> {
  const safePkg = assertValidPackageName(pkg);
  for (const ext of ['png', 'webp'] as const) {
    const file = path.join(CACHE_DIR, `${safePkg}.${ext}`);
    try {
      const buffer = await fs.readFile(file);
      if (buffer.length > 64) {
        return { buffer, contentType: ext === 'png' ? 'image/png' : 'image/webp' };
      }
    } catch {
      // Cache miss
    }
  }
  return null;
}

/** Guarda un icono real en caché local de disco. */
export async function saveCachedIcon(
  pkg: string,
  buffer: Buffer,
  ext: 'png' | 'webp'
): Promise<void> {
  const safePkg = assertValidPackageName(pkg);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(path.join(CACHE_DIR, `${safePkg}.${ext}`), buffer);
}

/** Extrae el icono PNG/WebP de mayor resolución desde un APK usando zipfile. */
async function extractIconFromApk(apkPath: string, outPath: string): Promise<'png' | 'webp' | null> {
  const pyScript = [
    'import sys, zipfile',
    'apk, out = sys.argv[1], sys.argv[2]',
    'with zipfile.ZipFile(apk) as z:',
    '  imgs = [n for n in z.namelist() if n.startswith("res/") and (n.endswith(".png") or n.endswith(".webp"))]',
    '  pri = [n for n in imgs if "ic_launcher" in n.lower() and "foreground" not in n.lower() and "background" not in n.lower()]',
    '  pool = pri or [n for n in imgs if "launcher" in n.lower() or "app_icon" in n.lower()]',
    '  if not pool: sys.exit(2)',
    '  best = max(pool, key=lambda n: z.getinfo(n).file_size)',
    '  ext = "webp" if best.endswith(".webp") else "png"',
    '  open(out + "." + ext, "wb").write(z.read(best))',
    '  print(ext)',
  ].join('\n');

  try {
    const { stdout } = await execFileAsync('python', ['-c', pyScript, apkPath, outPath], {
      timeout: 5000,
      windowsHide: true,
    });
    const ext = stdout.trim();
    return ext === 'webp' ? 'webp' : ext === 'png' ? 'png' : null;
  } catch {
    return null;
  }
}

/** Extrae el icono real de un paquete directamente desde el dispositivo ADB. */
export async function extractDeviceApkIcon(
  pkg: string,
  serial?: string | null
): Promise<CachedIcon | null> {
  const safePkg = assertValidPackageName(pkg);
  const adbPrefix = serial && isValidDeviceSerial(serial) ? ['-s', serial] : [];

  const { stdout } = await execFileAsync(ADB, [...adbPrefix, 'shell', 'pm', 'path', safePkg], {
    timeout: 4000,
    windowsHide: true,
  });

  const paths = stdout
    .split('\n')
    .map((l) => l.replace('package:', '').trim())
    .filter(Boolean);
  if (paths.length === 0) return null;

  // Priorizar split DPI (muy liviano) antes de base.apk
  const ordered = [
    ...paths.filter((p) => /dpi\.apk$/i.test(p)),
    ...paths.filter((p) => !/dpi\.apk$/i.test(p)),
  ];

  const tmpBase = path.join(os.tmpdir(), `ap_ico_${safePkg}_${Date.now()}`);
  const tmpApk = `${tmpBase}.apk`;

  for (const remoteApk of ordered.slice(0, 2)) {
    try {
      const { stdout: sizeOut } = await execFileAsync(
        ADB,
        [...adbPrefix, 'shell', 'stat', '-c', '%s', remoteApk],
        { timeout: 3000, windowsHide: true }
      );
      if (Number(sizeOut.trim()) > MAX_APK_BYTES) continue;

      await execFileAsync(ADB, [...adbPrefix, 'pull', remoteApk, tmpApk], {
        timeout: 8000,
        windowsHide: true,
      });

      const ext = await extractIconFromApk(tmpApk, tmpBase);
      if (ext) {
        const extractedPath = `${tmpBase}.${ext}`;
        const buffer = await fs.readFile(extractedPath);
        await saveCachedIcon(safePkg, buffer, ext);
        await fs.unlink(extractedPath).catch(() => {});
        return { buffer, contentType: ext === 'png' ? 'image/png' : 'image/webp' };
      }
    } catch {
      // Intentar siguiente APK split
    } finally {
      await fs.unlink(tmpApk).catch(() => {});
    }
  }
  return null;
}
