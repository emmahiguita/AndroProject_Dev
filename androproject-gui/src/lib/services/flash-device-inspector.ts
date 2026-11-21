// ============================================================================
// ARCHIVO: flash-device-inspector.ts
// QUÉ HACE: Detecta el modo real de arranque del dispositivo (ADB, Recovery,
//           Sideload, Fastboot o Hardware USB) y extrae sus variables de
//           seguridad (Bootloader lock, Slot A/B, VBMeta, OEM Unlock).
// CÓMO FUNCIONA: Consulta `adb devices` y `fastboot devices`; si está en ADB
//           lee propiedades `ro.boot.*` en un solo lote, y si está en Fastboot
//           consulta `fastboot getvar`.
// POR QUÉ: Desacoplar la inspección de bajo nivel de `/api/flash/route.ts` y
//           mostrar datos reales del bootloader sin simulaciones (< 200L).
// ============================================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import { ADB, FASTBOOT } from '@/lib/config';

const execAsyncOrig = promisify(exec);

export async function runFlashCmd(
  command: string,
  options: { timeout?: number; maxBuffer?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  const res = await execAsyncOrig(command, {
    encoding: 'utf8',
    timeout: options.timeout ?? 10000,
    maxBuffer: options.maxBuffer ?? 4 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    stdout: typeof res.stdout === 'string' ? res.stdout : String(res.stdout || ''),
    stderr: typeof res.stderr === 'string' ? res.stderr : String(res.stderr || ''),
  };
}

export function extractCmdError(error: unknown): string {
  if (typeof error !== 'object' || error === null) return String(error);
  const f = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
  return [f.stderr, f.stdout, f.message]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join('\n')
    .trim();
}

export interface FlashInspectionResult {
  state: 'adb' | 'recovery' | 'sideload' | 'fastboot' | 'hardware_only' | 'unknown';
  deviceInfo: Record<string, string>;
}

/**
 * Inspecciona el estado real del dispositivo para operaciones de flasheo.
 */
export async function inspectFlashDeviceState(serial?: string | null): Promise<FlashInspectionResult> {
  let state: FlashInspectionResult['state'] = 'unknown';
  const deviceInfo: Record<string, string> = {};
  const validSerial = serial && serial !== 'Hardware Level' ? serial : null;

  // 1. Verificar ADB (normal, recovery, sideload)
  try {
    const { stdout } = await runFlashCmd(`"${ADB}" devices`, { timeout: 3000 });
    const lines = stdout.split('\n').slice(1);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (validSerial && !line.startsWith(validSerial)) continue;
      const [devSerial, devState] = line.split(/\s+/);
      if (devState === 'device') { state = 'adb'; deviceInfo.serialno = devSerial; break; }
      if (devState === 'recovery') { state = 'recovery'; deviceInfo.serialno = devSerial; break; }
      if (devState === 'sideload') { state = 'sideload'; deviceInfo.serialno = devSerial; break; }
    }
  } catch { /* ADB no disponible */ }

  // Si está en ADB, leer propiedades reales del bootloader y particiones A/B
  if (state === 'adb') {
    try {
      const target = deviceInfo.serialno ? `"${ADB}" -s ${deviceInfo.serialno}` : `"${ADB}"`;
      const propCmd = [
        'getprop ro.product.model',
        'getprop ro.boot.slot_suffix',
        'getprop ro.boot.flash.locked',
        'getprop ro.boot.verifiedbootstate',
        'getprop ro.boot.vbmeta.device_state',
        'settings get global oem_unlock_allowed',
        'getprop ro.build.ab_update',
      ].join('; echo "---"; ');
      const { stdout } = await runFlashCmd(`${target} shell "${propCmd}"`, { timeout: 3500 });
      const parts = stdout.split('---').map((s) => s.trim());
      deviceInfo.product = parts[0] || 'Android';
      deviceInfo['current-slot'] = (parts[1] || '').replace(/^_/, '') || 'a';
      deviceInfo.unlocked = parts[2] === '0' ? 'yes' : 'no';
      deviceInfo.verifiedboot = parts[3] || 'green';
      deviceInfo.vbmeta = parts[4] || 'locked';
      deviceInfo.oem_allowed = parts[5] === '1' ? 'Permitido' : 'Bloqueado';
      deviceInfo.ab_device = parts[6] === 'true' ? 'A/B Dinámico' : 'Estándar';
    } catch { /* Propiedades parciales */ }
    return { state, deviceInfo };
  }

  // 2. Verificar Fastboot
  try {
    const { stdout } = await runFlashCmd(`"${FASTBOOT}" devices`, { timeout: 3000 });
    for (const rawLine of stdout.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      if (validSerial && !line.startsWith(validSerial)) continue;
      if (line.includes('fastboot')) {
        state = 'fastboot';
        deviceInfo.serialno = line.split(/\s+/)[0] || validSerial || '--';
        break;
      }
    }
  } catch { /* Fastboot no respondió */ }

  if (state === 'fastboot') {
    const fbTarget = deviceInfo.serialno && deviceInfo.serialno !== '--'
      ? `"${FASTBOOT}" -s ${deviceInfo.serialno}`
      : `"${FASTBOOT}"`;
    const vars = ['product', 'unlocked', 'current-slot', 'secure', 'max-download-size'];
    for (const v of vars) {
      try {
        const { stderr, stdout } = await runFlashCmd(`${fbTarget} getvar ${v}`, { timeout: 2000 });
        const combined = `${stderr}\n${stdout}`;
        const m = combined.match(new RegExp(`${v.replace(/[:\\-]/g, '\\$&')}:\\s*(.+)`));
        if (m) deviceInfo[v] = m[1].trim();
      } catch (e: unknown) {
        const m = extractCmdError(e).match(new RegExp(`${v.replace(/[:\\-]/g, '\\$&')}:\\s*(.+)`));
        if (m) deviceInfo[v] = m[1].trim();
      }
    }
    return { state, deviceInfo };
  }

  return { state, deviceInfo };
}
