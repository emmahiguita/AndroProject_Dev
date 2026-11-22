import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { ADB, ANDROPROJECT_HOME } from '@/lib/config';
import { installIpaBuffer } from '@/lib/services/ios-ipa-installer';
import { isValidDeviceSerial } from '@/lib/security/input-sanitizer';

const execFileAsync = promisify(execFile);
const MAX_APK_SIZE = 500 * 1024 * 1024;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export async function POST(req: Request) {
  let filePath: string | null = null;

  try {
    const formData = await req.formData();
    const fileEntry = formData.get('file');
    const serialEntry = formData.get('serial');
    const serial = typeof serialEntry === 'string' ? serialEntry : null;

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ success: false, error: 'No se envió ningún archivo.' }, { status: 400 });
    }
    const ext = path.extname(fileEntry.name).toLowerCase();
    if (ext !== '.apk' && ext !== '.ipa') {
      return NextResponse.json({ success: false, error: 'El archivo debe tener extensión .apk o .ipa.' }, { status: 400 });
    }
    if (fileEntry.size > MAX_APK_SIZE) {
      return NextResponse.json({ success: false, error: 'El paquete supera el límite de 500 MB.' }, { status: 413 });
    }
    if (ext === '.ipa') {
      const buf = Buffer.from(await fileEntry.arrayBuffer());
      const res = await installIpaBuffer(fileEntry.name, buf, serial || undefined);
      return NextResponse.json(res, { status: res.success ? 200 : 500 });
    }

    const tempDir = path.join(ANDROPROJECT_HOME, 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });
    filePath = path.join(tempDir, `${randomUUID()}.apk`);

    await pipeline(
      Readable.fromWeb(fileEntry.stream() as Parameters<typeof Readable.fromWeb>[0]),
      fs.createWriteStream(filePath),
    );

    if (serial && serial !== 'Hardware Level' && !isValidDeviceSerial(serial)) {
      return NextResponse.json({ success: false, error: 'Serial de dispositivo inválido.' }, { status: 400 });
    }
    const targetArgs = serial && serial !== 'Hardware Level' ? ['-s', serial] : [];
    const { stdout, stderr } = await execFileAsync(
      ADB,
      [...targetArgs, 'install', '-r', filePath],
      { timeout: 300_000, windowsHide: true },
    );
    const output = `${stdout}\n${stderr}`;
    if (!/\bSuccess\b/i.test(output)) {
      return NextResponse.json({ success: false, error: output.trim() || 'ADB no pudo instalar el APK.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `APK ${path.basename(fileEntry.name)} instalada correctamente.`,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error('[Install API] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    if (filePath) await fs.promises.rm(filePath, { force: true }).catch(() => {});
  }
}