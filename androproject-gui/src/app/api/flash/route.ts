import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { ADB, FASTBOOT } from '@/lib/config';

const execAsync = promisify(exec);
const FLASH_DIR = path.join(process.cwd(), 'temp', 'flash');

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const getCommandOutput = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return String(error);
  const failure = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
  return [failure.message, failure.stderr, failure.stdout]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n');
};

const isValidSerial = (serial: string) => /^[A-Za-z0-9._:-]+$/.test(serial);

// Valid fastboot partitions — CORREGIDO: incluye A/B slots y particiones críticas
const VALID_PARTITIONS = [
  'boot', 'recovery', 'system', 'vendor', 'dtbo', 'vbmeta',
  'userdata', 'super', 'product', 'odm', 'vendor_boot', 'init_boot',
  // A/B slots
  'boot_a', 'boot_b', 'recovery_a', 'recovery_b', 'vendor_boot_a', 'vendor_boot_b',
  'dtbo_a', 'dtbo_b', 'vbmeta_a', 'vbmeta_b', 'init_boot_a', 'init_boot_b',
  // Critical low-level partitions (use with caution)
  'bootloader', 'radio', 'modem', 'persist', 'misc', 'logo',
];
const CRITICAL_PARTITIONS = new Set(['bootloader', 'radio', 'modem', 'persist', 'misc']);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const action = formData.get('action') as string;
    const partition = formData.get('partition') as string;
    const serial = formData.get('serial') as string | null;
    const criticalConfirmed = formData.get('confirmCritical') === 'true';

    if (serial && serial !== 'Hardware Level' && !isValidSerial(serial)) {
      return NextResponse.json({ success: false, error: 'Identificador de dispositivo inválido.' }, { status: 400 });
    }

    const adbTarget = (serial && serial !== 'Hardware Level') ? `"${ADB}" -s ${serial}` : `"${ADB}"`;
    const fastbootTarget = (serial && serial !== 'Hardware Level') ? `"${FASTBOOT}" -s ${serial}` : `"${FASTBOOT}"`;

    // ── Action: Check device state ──
    if (action === 'check_state') {
      let state = 'unknown';
      const deviceInfo: Record<string, string> = {};

      // Try ADB first
      try {
        const { stdout } = await execAsync(`"${ADB}" devices`);
        const lines = stdout.split('\n').slice(1);
        for (const line of lines) {
          if (serial && serial !== 'Hardware Level') {
            if (line.startsWith(serial)) {
              if (line.includes('\tdevice')) { state = 'adb'; break; }
              if (line.includes('\trecovery')) { state = 'recovery'; break; }
              if (line.includes('\tsideload')) { state = 'sideload'; break; }
            }
          } else {
            if (line.includes('\tdevice')) { state = 'adb'; break; }
            if (line.includes('\trecovery')) { state = 'recovery'; break; }
            if (line.includes('\tsideload')) { state = 'sideload'; break; }
          }
        }
      } catch {}

      // Try Fastboot
      if (state === 'unknown') {
        try {
          const { stdout } = await execAsync(`"${FASTBOOT}" devices`);
          if (serial && serial !== 'Hardware Level') {
            if (stdout.includes(serial)) {
              state = 'fastboot';
            }
          } else if (stdout.trim().includes('fastboot')) {
            state = 'fastboot';
          }
        } catch {}
      }

      // Hardware fallback (include 'ossi' and VID_18D1 to detect devices in fastboot mode without drivers)
      if (state === 'unknown') {
        try {
          const psScript = `Get-PnpDevice -PresentOnly | Where-Object { $_.FriendlyName -match 'Android|Fastboot|SAMSUNG Mobile|ADB|ossi' -or $_.InstanceId -match 'VID_18D1' } | Where-Object Class -match 'USB|Modem|AndroidUsbDeviceClass' | Select-Object -ExpandProperty FriendlyName -First 1`;
          const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript}"`);
          if (stdout.trim()) {
            state = 'hardware_only';
            deviceInfo.hwName = stdout.trim();
          }
        } catch {}
      }

      // Get fastboot info if in fastboot mode
      if (state === 'fastboot') {
        try {
          // CORREGIDO: variables esenciales para flasheo seguro
          const vars = ['product', 'serialno', 'secure', 'unlocked', 'variant',
            'max-download-size', 'version-bootloader', 'version-baseband',
            'current-slot', 'slot-count', 'has-slot:boot',
            'battery-voltage', 'anti'  // anti-rollback version (MediaTek/Oppo)
          ];
          for (const v of vars) {
            try {
              const { stderr } = await execAsync(`${fastbootTarget} getvar ${v}`, { timeout: 3000 });
              // fastboot outputs to stderr
              const match = stderr.match(new RegExp(`${v.replace(/[:\\-]/g, '\\$&')}:\\s*(.+)`));
              if (match) deviceInfo[v] = match[1].trim();
            } catch (e: unknown) {
              const match = getCommandOutput(e).match(new RegExp(`${v.replace(/[:\\-]/g, '\\$&')}:\\s*(.+)`));
              if (match) deviceInfo[v] = match[1].trim();
            }
          }
        } catch {}
      }

      return NextResponse.json({ state, deviceInfo });
    }

    // ── Action: OEM Unlock status ──
    if (action === 'oem_unlock_check') {
      try {
        const { stdout } = await execAsync(`${adbTarget} shell settings get global oem_unlock_allowed`);
        const allowed = stdout.trim() === '1';
        return NextResponse.json({ success: true, unlocked: allowed });
      } catch (e: unknown) {
        return NextResponse.json({ success: false, error: getErrorMessage(e) });
      }
    }

    // ── Action: Enable OEM Unlock ──
    if (action === 'oem_unlock_enable') {
      try {
        // CORREGIDO: advertir que requiere root en Android 10+
        const { stdout, stderr } = await execAsync(`${adbTarget} shell settings put global oem_unlock_allowed 1`, { timeout: 5000 });
        const output = (stdout + stderr).toLowerCase();
        if (output.includes('permission denial') || output.includes('not allowed') || output.includes('operation not permitted')) {
          return NextResponse.json({
            success: false,
            error: 'Permiso denegado. En Android 10+ se requiere ROOT para habilitar OEM Unlock por ADB. Actívalo manualmente en: Ajustes > Opciones de Desarrollador > Desbloqueo OEM'
          });
        }
        return NextResponse.json({ success: true, message: 'OEM Unlock habilitado. Verifica en Ajustes > Opciones de Desarrollador > Desbloqueo OEM.' });
      } catch (e: unknown) {
        return NextResponse.json({ success: false, error: getCommandOutput(e) });
      }
    }

    // ── Action: Reboot to bootloader ──
    if (action === 'reboot_bootloader') {
      try {
        await execAsync(`${adbTarget} reboot bootloader`);
        return NextResponse.json({ success: true, message: 'Reiniciando en modo Bootloader...' });
      } catch (e: unknown) {
        return NextResponse.json({ success: false, error: getErrorMessage(e) });
      }
    }

    // ── Action: Fastboot Unlock ──
    // CORREGIDO: intenta flashing unlock (Google/AOSP), luego oem unlock (OPPO/MediaTek),
    // y finalmente oem unlock-go (algunos Xiaomi/MediaTek)
    if (action === 'fastboot_unlock') {
      let lastError = '';
      const unlockCommands = [
        ['flashing', 'unlock'],
        ['oem', 'unlock'],
        ['oem', 'unlock-go'],
      ];
      let success = false;
      let message = '';
      for (const [cmd, sub] of unlockCommands) {
        try {
          const { stdout, stderr } = await execAsync(`${fastbootTarget} ${cmd} ${sub}`, { timeout: 15000 });
          success = true;
          message = stdout || stderr;
          break;
        } catch (e: unknown) {
          lastError = getCommandOutput(e);
          // Si el comando no es reconocido, probar el siguiente
          if (lastError.toLowerCase().includes('unknown command') || lastError.toLowerCase().includes('usage')) {
            continue;
          }
          // Si es otro error (bootloader rechaza), no seguir intentando
          break;
        }
      }
      if (success) {
        return NextResponse.json({ success: true, message });
      }
      return NextResponse.json({ success: false, error: `Todos los métodos fallaron. Último error: ${lastError}` });
    }

    // ── Action: Fastboot Lock ──
    if (action === 'fastboot_lock') {
      try {
        const { stdout, stderr } = await execAsync(`${fastbootTarget} flashing lock`);
        return NextResponse.json({ success: true, message: stdout || stderr });
      } catch (e: unknown) {
        return NextResponse.json({ success: false, error: getCommandOutput(e) });
      }
    }

    // ── Action: Fastboot OEM Device Info ──
    if (action === 'fastboot_oem_device_info') {
      try {
        let info = '';
        try {
          const { stdout, stderr } = await execAsync(`${fastbootTarget} oem device-info`);
          info += (stdout + '\n' + stderr).trim();
        } catch (err: unknown) {
          info += 'oem device-info error: ' + getCommandOutput(err);
        }

        info += '\n\n';

        try {
          const { stdout, stderr } = await execAsync(`${fastbootTarget} flashing get_unlock_ability`);
          info += 'Unlock Ability:\n' + (stdout + '\n' + stderr).trim();
        } catch (err: unknown) {
          info += 'get_unlock_ability error: ' + getCommandOutput(err);
        }

        return NextResponse.json({ success: true, info });
      } catch (e: unknown) {
        return NextResponse.json({ success: false, error: getCommandOutput(e) });
      }
    }

    // ── Action: Flash an image file to a partition ──
    if (action === 'flash') {
      if (!file) {
        return NextResponse.json({ success: false, error: 'No se envió ningún archivo de imagen.' }, { status: 400 });
      }

      if (!partition || !VALID_PARTITIONS.includes(partition)) {
        return NextResponse.json({ success: false, error: `Partición inválida: "${partition}". Válidas: ${VALID_PARTITIONS.join(', ')}` }, { status: 400 });
      }
      if (CRITICAL_PARTITIONS.has(partition) && !criticalConfirmed) {
        return NextResponse.json({ success: false, error: 'La partición crítica requiere confirmación explícita.' }, { status: 400 });
      }

      await fs.promises.mkdir(FLASH_DIR, { recursive: true });
      const safeName = path.basename(file.name) || `${partition}.img`;
      const filePath = path.join(FLASH_DIR, `${randomUUID()}${path.extname(safeName) || '.img'}`);

      try {
        await pipeline(
          Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]),
          fs.createWriteStream(filePath),
        );
        const { stdout, stderr } = await execAsync(
          `${fastbootTarget} flash ${partition} "${filePath}"`,
          { timeout: 300000 },
        );
        const output = `${stdout}\n${stderr}`;
        if (/\berror\b/i.test(output) && !/finished/i.test(output)) {
          return NextResponse.json({ success: false, error: output.trim() });
        }
        return NextResponse.json({
          success: true,
          message: `✓ Partición "${partition}" flasheada correctamente con ${safeName}.`,
        });
      } catch (error: unknown) {
        return NextResponse.json({ success: false, error: getCommandOutput(error) || getErrorMessage(error) });
      } finally {
        await fs.promises.rm(filePath, { force: true }).catch(() => {});
      }
    }

    // Action: ADB sideload desde recovery
    if (action === 'sideload') {
      if (!file) {
        return NextResponse.json({ success: false, error: 'No se envió ningún archivo ZIP.' }, { status: 400 });
      }

      await fs.promises.mkdir(FLASH_DIR, { recursive: true });
      const safeName = path.basename(file.name) || 'update.zip';
      const filePath = path.join(FLASH_DIR, `${randomUUID()}${path.extname(safeName) || '.zip'}`);

      try {
        await pipeline(
          Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]),
          fs.createWriteStream(filePath),
        );
        await execAsync(`${adbTarget} sideload "${filePath}"`, { timeout: 600000 });
        return NextResponse.json({
          success: true,
          message: `✓ Archivo ${safeName} enviado por sideload correctamente.`,
        });
      } catch (error: unknown) {
        return NextResponse.json({ success: false, error: getCommandOutput(error) || getErrorMessage(error) });
      } finally {
        await fs.promises.rm(filePath, { force: true }).catch(() => {});
      }
    }

    return NextResponse.json({ success: false, error: 'Acción de flash no reconocida' }, { status: 400 });

  } catch (error: unknown) {
    console.error('[Flash API] Error:', getErrorMessage(error));
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
