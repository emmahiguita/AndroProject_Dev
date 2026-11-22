// ============================================================================
// ARCHIVO: apk-icon-extractor.ts
// QUÉ HACE: Extrae iconos reales (PNG/WebP) desde los APKs del dispositivo
//           Android con caché positiva/negativa en disco, deduplicación de
//           peticiones en vuelo y semáforo de concurrencia ADB (máx 3 pulls).
// CÓMO FUNCIONA:
//   1. Verifica caché en memoria/disco (`readCachedIcon` / `isKnownMissingIcon`).
//   2. Si ya hay una extracción en curso para el mismo paquete, reutiliza su Promise.
//   3. Limita a 3 `adb pull` concurrentes para no saturar el bus USB/Wi-Fi.
// POR QUÉ: Eliminar el cuello de botella de 400 pulls simultáneos (< 170 líneas).
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
const MAX_APK_BYTES = 18 * 1024 * 1024;
const MAX_CONCURRENT_PULLS = 3;

export interface CachedIcon {
  buffer: Buffer;
  contentType: 'image/png' | 'image/webp';
}

const memoryIconCache = new Map<string, CachedIcon>();
const missingIconSet = new Set<string>();
const inflightMap = new Map<string, Promise<CachedIcon | null>>();
let activePulls = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activePulls < MAX_CONCURRENT_PULLS) {
    activePulls++;
    return;
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  activePulls++;
}

function releaseSlot(): void {
  activePulls = Math.max(0, activePulls - 1);
  const next = waitQueue.shift();
  if (next) next();
}

/** Comprueba si un paquete ya fue marcado como sin icono rasterizado. */
export async function isKnownMissingIcon(pkg: string): Promise<boolean> {
  const safePkg = assertValidPackageName(pkg);
  if (missingIconSet.has(safePkg)) return true;
  try {
    await fs.access(path.join(CACHE_DIR, `${safePkg}.miss`));
    missingIconSet.add(safePkg);
    return true;
  } catch {
    return false;
  }
}

/** Marca un paquete como sin icono para evitar re-intentos costosos por ADB/HTTP. */
export async function markMissingIcon(pkg: string): Promise<void> {
  const safePkg = assertValidPackageName(pkg);
  missingIconSet.add(safePkg);
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(path.join(CACHE_DIR, `${safePkg}.miss`), '');
  } catch {}
}

/** Lee un icono ya cacheado en memoria o disco si existe (latencia < 1ms). */
export async function readCachedIcon(pkg: string): Promise<CachedIcon | null> {
  const safePkg = assertValidPackageName(pkg);
  const mem = memoryIconCache.get(safePkg);
  if (mem) return mem;

  for (const ext of ['png', 'webp'] as const) {
    const file = path.join(CACHE_DIR, `${safePkg}.${ext}`);
    try {
      const buffer = await fs.readFile(file);
      if (buffer.length > 64) {
        const hit: CachedIcon = { buffer, contentType: ext === 'png' ? 'image/png' : 'image/webp' };
        if (memoryIconCache.size < 500) memoryIconCache.set(safePkg, hit);
        return hit;
      }
    } catch {}
  }
  return null;
}

/** Guarda un icono real en caché local de memoria y disco. */
export async function saveCachedIcon(pkg: string, buffer: Buffer, ext: 'png' | 'webp'): Promise<void> {
  const safePkg = assertValidPackageName(pkg);
  missingIconSet.delete(safePkg);
  if (memoryIconCache.size < 500) {
    memoryIconCache.set(safePkg, { buffer, contentType: ext === 'png' ? 'image/png' : 'image/webp' });
  }
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
    const { stdout } = await execFileAsync('python', ['-c', pyScript, apkPath, outPath], { timeout: 4000, windowsHide: true });
    const ext = stdout.trim();
    return ext === 'webp' ? 'webp' : ext === 'png' ? 'png' : null;
  } catch {
    return null;
  }
}

async function runDeviceExtraction(safePkg: string, serial?: string | null): Promise<CachedIcon | null> {
  await acquireSlot();
  try {
    const adbPrefix = serial && isValidDeviceSerial(serial) ? ['-s', serial] : [];
    const { stdout } = await execFileAsync(ADB, [...adbPrefix, 'shell', 'pm', 'path', safePkg], { timeout: 3000, windowsHide: true });
    const paths = stdout.split('\n').map((l) => l.replace('package:', '').trim()).filter(Boolean);
    if (paths.length === 0) return null;

    const ordered = [...paths.filter((p) => /dpi\.apk$/i.test(p)), ...paths.filter((p) => !/dpi\.apk$/i.test(p))];
    const tmpBase = path.join(os.tmpdir(), `ap_ico_${safePkg}_${Date.now()}`);
    const tmpApk = `${tmpBase}.apk`;

    for (const remoteApk of ordered.slice(0, 2)) {
      try {
        const { stdout: sizeOut } = await execFileAsync(ADB, [...adbPrefix, 'shell', 'stat', '-c', '%s', remoteApk], { timeout: 2500, windowsHide: true });
        if (Number(sizeOut.trim()) > MAX_APK_BYTES) continue;
        await execFileAsync(ADB, [...adbPrefix, 'pull', remoteApk, tmpApk], { timeout: 6000, windowsHide: true });
        const ext = await extractIconFromApk(tmpApk, tmpBase);
        if (ext) {
          const extractedPath = `${tmpBase}.${ext}`;
          const buffer = await fs.readFile(extractedPath);
          await saveCachedIcon(safePkg, buffer, ext);
          await fs.unlink(extractedPath).catch(() => {});
          return { buffer, contentType: ext === 'png' ? 'image/png' : 'image/webp' };
        }
      } catch {} finally {
        await fs.unlink(tmpApk).catch(() => {});
      }
    }
    return null;
  } finally {
    releaseSlot();
  }
}

/** Extrae el icono real deduplicando llamadas concurrentes para el mismo paquete. */
export async function extractDeviceApkIcon(pkg: string, serial?: string | null): Promise<CachedIcon | null> {
  const safePkg = assertValidPackageName(pkg);
  const existing = inflightMap.get(safePkg);
  if (existing) return existing;

  const promise = runDeviceExtraction(safePkg, serial).finally(() => inflightMap.delete(safePkg));
  inflightMap.set(safePkg, promise);
  return promise;
}
