// ============================================================================
// ARCHIVO: icon/route.ts
// QUÉ HACE: Sirve iconos reales de aplicaciones Android vía GET /api/apps/icon.
// CÓMO FUNCIONA: 1) Lee caché de disco (<2ms), 2) Extrae el icono real desde
//           el APK del dispositivo vía ADB, 3) Fallback a Play Store si el
//           dispositivo no está conectado o el APK solo trae XML vectorial.
// POR QUÉ: Garantizar iconos reales rápidos, seguros y sin fuga de temporales.
// ============================================================================

import { NextResponse } from 'next/server';
import { assertValidPackageName, isValidDeviceSerial } from '@/lib/security/input-sanitizer';
import {
  extractDeviceApkIcon,
  readCachedIcon,
  saveCachedIcon,
} from '@/lib/services/apk-icon-extractor';

const playUrlCache = new Map<string, string>();

/** Descarga imagen og:image desde Play Store como último fallback y la cachea. */
async function fetchPlayStoreFallback(pkg: string): Promise<Response | null> {
  const cachedUrl = playUrlCache.get(pkg);
  if (cachedUrl) return NextResponse.redirect(cachedUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
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

    // 1. Caché local en disco (instantáneo)
    const cached = await readCachedIcon(pkg);
    if (cached) {
      return new Response(new Uint8Array(cached.buffer), {
        headers: { 'Content-Type': cached.contentType, 'Cache-Control': 'public, max-age=86400' },
      });
    }

    // 2. Extracción real desde el APK instalado en el dispositivo ADB
    const fromApk = await extractDeviceApkIcon(pkg, serial).catch(() => null);
    if (fromApk) {
      return new Response(new Uint8Array(fromApk.buffer), {
        headers: { 'Content-Type': fromApk.contentType, 'Cache-Control': 'public, max-age=86400' },
      });
    }

    // 3. Fallback a Google Play Store (para iconos adaptativos XML o sin USB)
    const fallback = await fetchPlayStoreFallback(pkg);
    if (fallback) return fallback;

    return new Response('Icon not found', { status: 404 });
  } catch {
    return new Response('Invalid package', { status: 400 });
  }
}
