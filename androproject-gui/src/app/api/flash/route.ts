// ============================================================================
// ARCHIVO: flash/route.ts
// QUÉ HACE: Endpoint backend real para operaciones de flasheo (Fastboot .img,
//           Boot temporal en RAM, ADB Sideload .zip), desbloqueo OEM/Bootloader,
//           apertura de Opciones de Desarrollador, cambio de slot A/B y reinicios.
// CÓMO FUNCIONA: Valida el serial y la partición contra una lista blanca
//           estricta, transmite archivos binarios por stream a disco temporal
//           y ejecuta `fastboot.exe` o `adb.exe` con limpieza garantizada.
// POR QUÉ: Proveer flasheo real y seguro (< 200 líneas, SOLID, cero simulación).
// ============================================================================

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { ADB, FASTBOOT } from '@/lib/config';
import { inspectFlashDeviceState, runFlashCmd, extractCmdError } from '@/lib/services/flash-device-inspector';

const FLASH_DIR = path.join(process.cwd(), 'temp', 'flash');
const isValidSerial = (s: string) => /^[A-Za-z0-9._:-]+$/.test(s);

const VALID_PARTITIONS = [
  'boot', 'recovery', 'system', 'vendor', 'dtbo', 'vbmeta',
  'userdata', 'super', 'product', 'odm', 'vendor_boot', 'init_boot',
  'boot_a', 'boot_b', 'recovery_a', 'recovery_b', 'vendor_boot_a', 'vendor_boot_b',
  'dtbo_a', 'dtbo_b', 'vbmeta_a', 'vbmeta_b', 'init_boot_a', 'init_boot_b',
  'bootloader', 'radio', 'modem', 'persist', 'misc', 'logo', 'cache',
];
const CRITICAL_PARTITIONS = new Set(['bootloader', 'radio', 'modem', 'persist', 'misc']);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const action = (formData.get('action') as string) || 'check_state';
    const partition = (formData.get('partition') as string) || '';
    const serial = formData.get('serial') as string | null;
    const slot = (formData.get('slot') as string) || 'a';
    const criticalConfirmed = formData.get('confirmCritical') === 'true';
    const disableVerity = formData.get('disableVerity') === 'true';

    if (serial && (serial.startsWith('apple-') || serial.startsWith('airplay-'))) {
      return NextResponse.json({
        success: false, state: 'unknown',
        deviceInfo: { product: 'Apple iOS (No compatible con Fastboot/Root Android)' },
        error: 'Fastboot y flasheo de particiones son exclusivos de Android.',
      });
    }
    if (serial && serial !== 'Hardware Level' && !isValidSerial(serial)) {
      return NextResponse.json({ success: false, error: 'Serial inválido.' }, { status: 400 });
    }

    const adbTarget = serial && serial !== 'Hardware Level' ? `"${ADB}" -s ${serial}` : `"${ADB}"`;
    const fbTarget = serial && serial !== 'Hardware Level' ? `"${FASTBOOT}" -s ${serial}` : `"${FASTBOOT}"`;

    // 1. Inspección completa de estado y variables del bootloader
    if (action === 'check_state') {
      const result = await inspectFlashDeviceState(serial);
      return NextResponse.json({ success: true, ...result });
    }

    // 2. Comprobar / habilitar OEM Unlock o abrir Opciones de Desarrollador en el móvil
    if (action === 'oem_unlock_check') {
      const { stdout } = await runFlashCmd(`${adbTarget} shell settings get global oem_unlock_allowed`);
      const unlocked = stdout.trim() === '1';
      return NextResponse.json({ success: true, unlocked, message: `Desbloqueo OEM en el sistema: ${unlocked ? 'PERMITIDO (1)' : 'BLOQUEADO (0)'}` });
    }

    if (action === 'open_dev_oem' || action === 'open_oem_settings') {
      await runFlashCmd(`${adbTarget} shell "settings put global development_settings_enabled 1 && am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS"`, { timeout: 6000 });
      return NextResponse.json({ success: true, message: 'Modo Desarrollador activado y pantalla «Opciones de desarrollador» abierta en el móvil.' });
    }

    if (action === 'oem_unlock_enable') {
      const { stdout, stderr } = await runFlashCmd(`${adbTarget} shell settings put global oem_unlock_allowed 1`, { timeout: 5000 });
      const out = `${stdout}\n${stderr}`.toLowerCase();
      if (out.includes('permission') || out.includes('not allowed') || out.includes('securityexception')) {
        await runFlashCmd(`${adbTarget} shell "settings put global development_settings_enabled 1 && am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS"`).catch(() => {});
        return NextResponse.json({ success: false, error: 'Android 10+ protege oem_unlock_allowed sin Root. Se abrió «Opciones de desarrollador» en el móvil.' });
      }
      return NextResponse.json({ success: true, message: 'Ajuste oem_unlock_allowed actualizado a 1.' });
    }

    // 3. Reinicios directos (ADB y Fastboot)
    const REBOOT_MAP: Record<string, [string, string]> = {
      reboot_system: [`${adbTarget} reboot`, 'Reiniciando dispositivo hacia Android normal.'],
      reboot_bootloader: [`${adbTarget} reboot bootloader`, 'Dispositivo reiniciando en modo Fastboot / Bootloader.'],
      reboot_recovery: [`${adbTarget} reboot recovery`, 'Dispositivo reiniciando en modo Recovery.'],
      reboot_fastbootd: [`${adbTarget} reboot fastboot`, 'Dispositivo reiniciando en modo Fastbootd (Userspace).'],
      fastboot_reboot: [`${fbTarget} reboot`, 'Reiniciando desde Fastboot hacia Android normal.'],
      fastboot_reboot_bootloader: [`${fbTarget} reboot-bootloader`, 'Reiniciando de nuevo al Bootloader.'],
      fastboot_reboot_fastbootd: [`${fbTarget} reboot fastboot`, 'Cambiando de Bootloader a Fastbootd (Userspace).'],
    };
    if (REBOOT_MAP[action]) {
      const [cmd, message] = REBOOT_MAP[action];
      await runFlashCmd(cmd);
      return NextResponse.json({ success: true, message });
    }

    // 4. Cambio de Slot A/B o borrado de partición en Fastboot
    if (action === 'fastboot_set_slot') {
      const targetSlot = slot === 'b' ? 'b' : 'a';
      const { stdout, stderr } = await runFlashCmd(`${fbTarget} --set-active=${targetSlot}`);
      return NextResponse.json({ success: true, message: `Slot activo cambiado a "${targetSlot.toUpperCase()}": ${(stdout || stderr).trim()}` });
    }
    if (action === 'fastboot_erase_partition') {
      const targetPart = VALID_PARTITIONS.includes(partition) ? partition : 'cache';
      const { stdout, stderr } = await runFlashCmd(`${fbTarget} erase ${targetPart}`);
      return NextResponse.json({ success: true, message: `Partición "${targetPart}" borrada: ${(stdout || stderr).trim()}` });
    }

    // 5. Desbloqueo / Bloqueo / Info OEM / Variables getvar all en Fastboot
    if (action === 'fastboot_unlock') {
      let lastError = '';
      for (const cmd of ['flashing unlock', 'oem unlock', 'oem unlock-go']) {
        try {
          const { stdout, stderr } = await runFlashCmd(`${fbTarget} ${cmd}`, { timeout: 15000 });
          return NextResponse.json({ success: true, message: (stdout || stderr || 'Comando enviado. Confirma en la pantalla del móvil.').trim() });
        } catch (e: unknown) {
          lastError = extractCmdError(e);
          if (lastError.toLowerCase().includes('unknown') || lastError.toLowerCase().includes('usage')) continue;
          break;
        }
      }
      return NextResponse.json({ success: false, error: lastError || 'El bootloader rechazó el desbloqueo.' });
    }

    if (action === 'fastboot_lock') {
      const { stdout, stderr } = await runFlashCmd(`${fbTarget} flashing lock`, { timeout: 15000 });
      return NextResponse.json({ success: true, message: (stdout || stderr || 'Comando de bloqueo enviado.').trim() });
    }

    if (action === 'fastboot_oem_device_info' || action === 'fastboot_getvar_all') {
      const subCmd = action === 'fastboot_getvar_all' ? 'getvar all' : 'oem device-info';
      let info = '';
      try {
        const { stdout, stderr } = await runFlashCmd(`${fbTarget} ${subCmd}`);
        info = `${stdout}\n${stderr}`.trim();
      } catch (e: unknown) { info = extractCmdError(e); }
      return NextResponse.json({ success: true, info, message: info || 'Sin salida del bootloader.' });
    }

    // 6. Flasheo de partición (.img / .bin), Boot temporal en RAM (`fastboot boot`) o ADB Sideload (.zip)
    if (action === 'flash' || action === 'fastboot_boot' || action === 'sideload') {
      if (!file) return NextResponse.json({ success: false, error: 'Selecciona un archivo válido.' }, { status: 400 });
      if (action === 'flash' && !VALID_PARTITIONS.includes(partition)) {
        return NextResponse.json({ success: false, error: `Partición no permitida: ${partition}` }, { status: 400 });
      }
      if (action === 'flash' && CRITICAL_PARTITIONS.has(partition) && !criticalConfirmed) {
        return NextResponse.json({ success: false, error: 'Partición crítica requiere confirmación.' }, { status: 400 });
      }
      await fs.promises.mkdir(FLASH_DIR, { recursive: true });
      const safeName = path.basename(file.name) || (action === 'sideload' ? 'update.zip' : `${partition || 'boot'}.img`);
      const ext = action === 'sideload' ? '.zip' : (path.extname(safeName) || '.img');
      const filePath = path.join(FLASH_DIR, `${randomUUID()}${ext}`);
      try {
        await pipeline(Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]), fs.createWriteStream(filePath));
        const avbFlags = action === 'flash' && disableVerity && partition.startsWith('vbmeta') ? '--disable-verity --disable-verification ' : '';
        const cmd = action === 'flash'
          ? `${fbTarget} ${avbFlags}flash ${partition} "${filePath}"`
          : action === 'fastboot_boot'
          ? `${fbTarget} boot "${filePath}"`
          : `${adbTarget} sideload "${filePath}"`;
        const { stdout, stderr } = await runFlashCmd(cmd, { timeout: action === 'sideload' ? 600000 : 300000 });
        const out = `${stdout}\n${stderr}`.trim();
        if (action !== 'sideload' && /\berror|failed\b/i.test(out) && !/finished/i.test(out)) {
          return NextResponse.json({ success: false, error: out });
        }
        return NextResponse.json({ success: true, message: `${action === 'flash' ? `Partición "${partition}" flasheada` : action === 'fastboot_boot' ? 'Imagen arrancada en RAM' : 'Sideload completado'} (${safeName}):\n${out}` });
      } finally {
        await fs.promises.rm(filePath, { force: true }).catch(() => {});
      }
    }

    return NextResponse.json({ success: false, error: `Acción desconocida: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: extractCmdError(error) }, { status: 500 });
  }
}
