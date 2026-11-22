// ============================================================================
// ARCHIVO: upload-file/route.ts
// QUÉ HACE: API bidireccional de archivos PC ↔ Android por ADB:
//           - GET: lista archivos/carpetas reales en `/sdcard/...` y descarga
//             (`?download=1`) archivos del dispositivo al PC (`adb pull`).
//           - POST: transfiere archivos desde el PC al dispositivo (`adb push`).
//           - DELETE: elimina un archivo del almacenamiento `/sdcard/...`.
// CÓMO FUNCIONA: Valida `serial` (`isValidDeviceSerial`) y restringe rutas
//           remotas a `/sdcard/` o `/storage/emulated/0/` sin `..` (anti-traversal).
// POR QUÉ: Completar el módulo Archivos con exploración y descarga real (<200L).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { ADB, ANDROPROJECT_HOME } from '@/lib/config';
import { isValidDeviceSerial } from '@/lib/security/input-sanitizer';

const execFileAsync = promisify(execFile);
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;
const getErrorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

function sanitizeRemotePath(raw?: string | null, fallback = '/sdcard/Download'): string | null {
  const clean = (raw || fallback).trim().replace(/\\/g, '/');
  if (clean.includes('..') || /[;&|`$<>]/.test(clean)) return null;
  if (!clean.startsWith('/sdcard') && !clean.startsWith('/storage/emulated/0')) return null;
  return clean.replace(/\/+$/, '') || '/sdcard';
}

function getTargetArgs(serial: string | null): string[] | NextResponse {
  if (!serial || serial === 'Hardware Level') return [];
  if (serial.startsWith('apple-') || serial.startsWith('airplay-')) {
    return NextResponse.json({ success: false, error: 'La gestión de archivos ADB aplica solo a Android.' }, { status: 400 });
  }
  if (!isValidDeviceSerial(serial)) {
    return NextResponse.json({ success: false, error: 'Serial de dispositivo inválido.' }, { status: 400 });
  }
  return ['-s', serial];
}

/** Lista directorio en Android o descarga un archivo vía `adb pull`. */
export async function GET(req: NextRequest) {
  const serial = req.nextUrl.searchParams.get('serial');
  const target = getTargetArgs(serial);
  if (target instanceof NextResponse) return target;

  const remotePath = sanitizeRemotePath(req.nextUrl.searchParams.get('path'), '/sdcard/Download');
  if (!remotePath) return NextResponse.json({ success: false, error: 'Ruta remota no permitida.' }, { status: 400 });

  if (req.nextUrl.searchParams.get('download') === '1') {
    const tempDir = path.join(ANDROPROJECT_HOME, 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });
    const tmpOut = path.join(tempDir, `${randomUUID()}_${path.basename(remotePath)}`);
    try {
      await execFileAsync(ADB, [...target, 'pull', remotePath, tmpOut], { timeout: 120_000, windowsHide: true });
      const buf = await fs.promises.readFile(tmpOut);
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(path.basename(remotePath))}"`,
        },
      });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: getErrorMessage(e) }, { status: 500 });
    } finally {
      await fs.promises.rm(tmpOut, { force: true }).catch(() => {});
    }
  }

  try {
    const { stdout } = await execFileAsync(ADB, [...target, 'shell', 'ls', '-la', remotePath], { timeout: 10_000, windowsHide: true });
    const entries = stdout.split(/\r?\n/).slice(1).map((line) => {
      const m = line.match(/^([dl\-])[rwxstST\-]{9}\s+\d+\s+\S+\s+\S+\s+(\d+)?\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(.+)$/);
      if (!m || m[3] === '.' || m[3] === '..') return null;
      return { name: m[3].trim(), isDir: m[1] === 'd', size: m[2] ? Number(m[2]) : 0 };
    }).filter((x): x is { name: string; isDir: boolean; size: number } => Boolean(x));
    entries.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    return NextResponse.json({ success: true, path: remotePath, entries });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(e), entries: [] }, { status: 500 });
  }
}

/** Sube archivo PC -> Android vía `adb push`. */
export async function POST(req: Request) {
  let filePath: string | null = null;
  try {
    const formData = await req.formData();
    const fileEntry = formData.get('file');
    const destination = sanitizeRemotePath(formData.get('dest') as string | null, '/sdcard/Download');
    const serial = typeof formData.get('serial') === 'string' ? (formData.get('serial') as string) : null;
    const target = getTargetArgs(serial);
    if (target instanceof NextResponse) return target;
    if (!destination) return NextResponse.json({ success: false, error: 'Carpeta destino no permitida.' }, { status: 400 });
    if (!(fileEntry instanceof File)) return NextResponse.json({ success: false, error: 'No se envió ningún archivo.' }, { status: 400 });
    if (fileEntry.size > MAX_UPLOAD_SIZE) return NextResponse.json({ success: false, error: 'El archivo supera 500 MB.' }, { status: 413 });

    const tempDir = path.join(ANDROPROJECT_HOME, 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });
    const safeName = path.basename(fileEntry.name) || 'archivo';
    filePath = path.join(tempDir, `${randomUUID()}${path.extname(safeName)}`);
    await pipeline(Readable.fromWeb(fileEntry.stream() as Parameters<typeof Readable.fromWeb>[0]), fs.createWriteStream(filePath));

    const remotePath = `${destination}/${safeName}`;
    await execFileAsync(ADB, [...target, 'push', filePath, remotePath], { timeout: 300_000, windowsHide: true });
    return NextResponse.json({ success: true, message: `Archivo ${safeName} transferido a ${remotePath}.` });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  } finally {
    if (filePath) await fs.promises.rm(filePath, { force: true }).catch(() => {});
  }
}

/** Elimina un archivo específico en `/sdcard/...` del dispositivo Android. */
export async function DELETE(req: NextRequest) {
  try {
    const { serial, path: rawPath } = (await req.json()) as { serial?: string; path?: string };
    const target = getTargetArgs(serial || null);
    if (target instanceof NextResponse) return target;
    const remotePath = sanitizeRemotePath(rawPath, '');
    if (!remotePath || remotePath === '/sdcard') return NextResponse.json({ success: false, error: 'Ruta no permitida.' }, { status: 400 });
    await execFileAsync(ADB, [...target, 'shell', 'rm', '-f', remotePath], { timeout: 10_000, windowsHide: true });
    return NextResponse.json({ success: true, message: `Eliminado del dispositivo: ${remotePath}` });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(e) }, { status: 500 });
  }
}
