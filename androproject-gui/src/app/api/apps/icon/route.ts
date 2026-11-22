// ============================================================================
// ARCHIVO: icon/route.ts
// QUÉ HACE: Sirve iconos reales de aplicaciones Android vía GET /api/apps/icon.
// CÓMO FUNCIONA:
//   1. Lee caché positiva en memoria/disco (<1ms).
//   2. Verifica caché negativa (`isKnownMissingIcon`) para responder 404 en <1ms.
//   3. Omite paquetes internos de sistema/OEM (`com.android.`, `com.mediatek.`,
//      `com.oplus.`, `.overlay`) que no tienen icono comercial en Play Store.
//   4. Extrae del APK con semáforo de 3 pulls máx y guarda resultado o `.miss`.
// POR QUÉ: Evitar que 300+ paquetes del sistema bloqueen la carga de iconos.
// ============================================================================

import { NextResponse } from 'next/server';
import { assertValidPackageName, isValidDeviceSerial } from '@/lib/security/input-sanitizer';
import {
  extractDeviceApkIcon,
  isKnownMissingIcon,
  markMissingIcon,
  readCachedIcon,
  saveCachedIcon,
} from '@/lib/services/apk-icon-extractor';

const playUrlCache = new Map<string, string>();

const INTERNAL_SYS_PREFIXES = [
  'android.',
  'com.android.',
  'com.mediatek.',
  'com.qualcomm.',
  'com.qti.',
  'com.oplus.',
  'com.coloros.',
  'com.heytap.',
  'com.sec.android.',
  'com.samsung.android.overlay',
  'com.google.android.overlay',
  'com.google.mainline.',
];

function isInternalSystemPackage(pkg: string): boolean {
  if (pkg === 'android' || pkg.includes('.overlay') || pkg.includes('auto_generated_rro')) return true;
  return INTERNAL_SYS_PREFIXES.some((prefix) => pkg.startsWith(prefix));
}

/** Descarga imagen og:image desde Play Store solo para apps de usuario/comerciales. */
async function fetchPlayStoreFallback(pkg: string): Promise<Response | null> {
  if (isInternalSystemPackage(pkg)) return null;

  const cachedUrl = playUrlCache.get(pkg);
  if (cachedUrl) return NextResponse.redirect(cachedUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2200);
  try {
    const res = await fetch(`https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match =
      html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
    if (!match?.[1]) return null;

    const imgRes = await fetch(match[1], { signal: controller.signal });
    if (imgRes.ok) {
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const isWebp = imgRes.headers.get('content-type')?.includes('webp');
      const ext = isWebp ? 'webp' : 'png';
      await saveCachedIcon(pkg, buf, ext).catch(() => {});
      return new Response(new Uint8Array(buf), {
        headers: {
          'Content-Type': isWebp ? 'image/webp' : 'image/png',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }
    playUrlCache.set(pkg, match[1]);
    return NextResponse.redirect(match[1]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPkg = searchParams.get('package');
    const rawSerial = searchParams.get('serial');
    if (!rawPkg) return new Response('Missing package parameter', { status: 400 });

    const pkg = assertValidPackageName(rawPkg);
    const serial = rawSerial && isValidDeviceSerial(rawSerial) ? rawSerial : null;

    // 1. Caché positiva en memoria/disco (<1ms)
    const cached = await readCachedIcon(pkg);
    if (cached) {
      return new Response(new Uint8Array(cached.buffer), {
        headers: { 'Content-Type': cached.contentType, 'Cache-Control': 'public, max-age=86400' },
      });
    }

    // 2. Caché negativa (<1ms) — evita re-descargar APKs sin icono
    if (await isKnownMissingIcon(pkg)) {
      return new Response('Icon not found', {
        status: 404,
        headers: { 'Cache-Control': 'public, max-age=86400' },
      });
    }

    // 3. Extracción desde APK instalado (solo si no es un overlay RRO puro)
    if (!pkg.includes('.overlay') && !pkg.includes('auto_generated_rro')) {
      const fromApk = await extractDeviceApkIcon(pkg, serial).catch(() => null);
      if (fromApk) {
        return new Response(new Uint8Array(fromApk.buffer), {
          headers: { 'Content-Type': fromApk.contentType, 'Cache-Control': 'public, max-age=86400' },
        });
      }
    }

    // 4. Fallback a Play Store para apps comerciales
    const fallback = await fetchPlayStoreFallback(pkg);
    if (fallback) return fallback;

    await markMissingIcon(pkg);
    return new Response('Icon not found', {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return new Response('Invalid package', { status: 400 });
  }
}
