// ============================================================================
// ARCHIVO: ios-ipa-installer.ts
// QUÉ HACE: Instala archivos `.ipa` firmados directamente en un iPhone/iPad
//           conectado por USB desde Windows usando `pymobiledevice3`.
// CÓMO FUNCIONA: Escribe el `.ipa` en un directorio temporal seguro, ejecuta
//           `python -m pymobiledevice3 apps install` con el UDID real si existe
//           y elimina siempre el temporal en el bloque `finally`.
// POR QUÉ: Permitir Drag & Drop e instalación iOS por USB sin Mac (SRP, <200L).
// ============================================================================

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);

/** Extrae el UDID limpio cuando el serial viene como `apple-<UDID>`. */
function extractIosUdid(serial?: string): string | null {
  if (!serial || !serial.startsWith('apple-')) return null;
  const raw = serial.slice('apple-'.length).trim();
  return raw && raw !== 'usb-device' ? raw : null;
}

/** Instala un Buffer `.ipa` en el iPhone conectado por USB vía pymobiledevice3. */
export async function installIpaBuffer(
  fileName: string,
  buffer: Buffer,
  serial?: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const tmpPath = path.join(os.tmpdir(), `andro_${Date.now()}_${safeName}`);

  try {
    await fs.writeFile(tmpPath, buffer);
    const args = ['-m', 'pymobiledevice3', 'apps', 'install'];
    const udid = extractIosUdid(serial);
    if (udid) args.push('--udid', udid);
    args.push(tmpPath);

    const { stdout, stderr } = await execFileAsync('python', args, {
      windowsHide: true,
      timeout: 120000,
    });
    return {
      success: true,
      message: `${safeName} instalado en iOS vía USB (${(stdout || stderr || 'OK').trim().slice(0, 80)})`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint = /signature|signer|0xe800801/i.test(msg)
      ? 'El .ipa requiere firma válida (Apple ID / Sideloadly / AltServer) antes de instalar.'
      : msg;
    return { success: false, error: hint };
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
