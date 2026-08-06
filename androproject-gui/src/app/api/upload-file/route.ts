import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { ADB, ANDROPROJECT_HOME } from '@/lib/config';

const execFileAsync = promisify(execFile);
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export async function POST(req: Request) {
  let filePath: string | null = null;

  try {
    const formData = await req.formData();
    const fileEntry = formData.get('file');
    const destinationEntry = formData.get('dest');
    const serialEntry = formData.get('serial');
    const destination = typeof destinationEntry === 'string' && destinationEntry.trim()
      ? destinationEntry.trim()
      : '/sdcard/Download';
    const serial = typeof serialEntry === 'string' ? serialEntry : null;

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ success: false, error: 'No se envió ningún archivo.' }, { status: 400 });
    }
    if (fileEntry.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ success: false, error: 'El archivo supera el límite de 500 MB.' }, { status: 413 });
    }

    const tempDir = path.join(ANDROPROJECT_HOME, 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });
    const safeName = path.basename(fileEntry.name) || 'archivo';
    filePath = path.join(tempDir, `${randomUUID()}${path.extname(safeName)}`);

    await pipeline(
      Readable.fromWeb(fileEntry.stream() as Parameters<typeof Readable.fromWeb>[0]),
      fs.createWriteStream(filePath),
    );

    const remotePath = `${destination.replace(/\/+$/, '')}/${safeName}`;
    const targetArgs = serial && serial !== 'Hardware Level' ? ['-s', serial] : [];
    await execFileAsync(
      ADB,
      [...targetArgs, 'push', filePath, remotePath],
      { timeout: 300_000, windowsHide: true },
    );

    return NextResponse.json({
      success: true,
      message: `Archivo ${safeName} transferido a ${remotePath}.`,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error('[Upload API] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    if (filePath) await fs.promises.rm(filePath, { force: true }).catch(() => {});
  }
}