// ============================================================================
// ARCHIVO: driver-manager.ts
// QUÉ HACE: Diagnóstico y gestión real de drivers USB en Windows (PnPUtil),
//           cruce con ADB/Fastboot, validación de firma `.cat` e instalación `.inf`.
// CÓMO FUNCIONA: Ejecuta `pnputil /enum-devices` (/connected y /problem) y
//           `adb`/`fastboot devices` en paralelo, parsea VID/PID y driver INF,
//           y usa `Get-AuthenticodeSignature` + `pnputil /add-driver` con UAC.
// POR QUÉ: Resolver fallos USB en Windows sin sobrescribir interfaces MTP/ADB
//           a ciegas (< 200 líneas, SOLID, cero simulación).
// ============================================================================

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { ADB, FASTBOOT } from '@/lib/config';

const execFileAsync = promisify(execFile);

export interface WindowsUsbEntry {
  instanceId: string;
  description: string;
  className: string;
  driverInf: string;
  status: string;
  problemCode: string;
  hardwareId: string;
}

export interface DriverScanReport {
  mobileUsb: WindowsUsbEntry[];
  problemDevices: WindowsUsbEntry[];
  adbDevices: string[];
  fastbootDevices: string[];
}

async function runSafe(bin: string, args: string[], timeout = 4000): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout, maxBuffer: 6 * 1024 * 1024, windowsHide: true,
    });
    return `${stdout || ''}\n${stderr || ''}`;
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    return `${e.stdout || ''}\n${e.stderr || ''}`;
  }
}

/** Parsea bloques de salida de `pnputil /enum-devices` (ES/EN). */
function parsePnpBlocks(raw: string): WindowsUsbEntry[] {
  const blocks = raw.split(/\r?\n\r?\n/);
  const list: WindowsUsbEntry[] = [];
  const pick = (b: string, re: RegExp) => b.match(re)?.[1]?.trim() || '';

  for (const b of blocks) {
    const instanceId = pick(b, /(?:Instance ID|Id\. de instancia):\s*(.+)/i);
    if (!instanceId) continue;
    list.push({
      instanceId,
      description: pick(b, /(?:Device Description|Descripci[óo]n del dispositivo):\s*(.+)/i),
      className: pick(b, /(?:Class Name|Nombre de clase):\s*(.+)/i),
      driverInf: pick(b, /(?:Driver Name|Nombre del controlador):\s*(.+)/i),
      status: pick(b, /(?:Status|Estado):\s*(.+)/i),
      problemCode: pick(b, /(?:Problem Code|C[óo]digo del problema):\s*(.+)/i),
      hardwareId: pick(b, /(?:Hardware IDs|Id\. de hardware):\s*(.+)/i),
    });
  }
  return list;
}

const MOBILE_USB_RE = /VID_(05AC|04E8|22D9|18D1|2717|12D1|0BB4|2A70|0E8D)|Android|ADB|Fastboot|Apple|SAMSUNG|OPPO|MediaTek|Qualcomm/i;

/** Escanea drivers USB conectados, dispositivos con problema y estado ADB/Fastboot. */
export async function scanWindowsDrivers(): Promise<DriverScanReport> {
  const [connRaw, probRaw, adbRaw, fbRaw] = await Promise.all([
    runSafe('pnputil', ['/enum-devices', '/connected', '/deviceids']),
    runSafe('pnputil', ['/enum-devices', '/problem', '/deviceids']),
    runSafe(ADB, ['devices', '-l']),
    runSafe(FASTBOOT, ['devices']),
  ]);

  const mobileUsb = parsePnpBlocks(connRaw).filter(
    (d) => MOBILE_USB_RE.test(d.instanceId) || MOBILE_USB_RE.test(d.description) || MOBILE_USB_RE.test(d.hardwareId),
  );
  const problemDevices = parsePnpBlocks(probRaw);
  const adbDevices = adbRaw.split('\n').slice(1).map((l) => l.trim()).filter(Boolean);
  const fastbootDevices = fbRaw.split('\n').map((l) => l.trim()).filter((l) => l.includes('fastboot'));

  return { mobileUsb, problemDevices, adbDevices, fastbootDevices };
}

/** Valida la firma digital de un catálogo `.cat` antes de instalar un driver OEM. */
export async function verifyCatalogSignature(catPath: string): Promise<{ valid: boolean; status: string }> {
  const clean = path.resolve(catPath.trim());
  if (!clean.toLowerCase().endsWith('.cat')) throw new Error('Debe indicar un archivo .cat válido.');
  await fs.access(clean);
  const psCmd = `(Get-AuthenticodeSignature -LiteralPath '${clean.replace(/'/g, "''")}').Status`;
  const out = (await runSafe('powershell', ['-NoProfile', '-Command', psCmd], 6000)).trim();
  return { valid: out === 'Valid', status: out || 'Unknown' };
}

/** Instala un paquete `.inf` OEM en el Driver Store de Windows vía PnPUtil (eleva UAC si requiere). */
export async function installInfDriver(infPath: string): Promise<{ success: boolean; message: string }> {
  const clean = path.resolve(infPath.trim());
  if (!clean.toLowerCase().endsWith('.inf')) throw new Error('Debe indicar un archivo .inf válido.');
  await fs.access(clean);

  const direct = await runSafe('pnputil', ['/add-driver', clean, '/install'], 15000);
  if (/added successfully|agreg[óo]|published name|nombre publicado/i.test(direct)) {
    return { success: true, message: direct.trim() };
  }

  // Si falta privilegio de Administrador, solicita elevación UAC nativa de Windows
  const ps = `Start-Process pnputil -ArgumentList '/add-driver','"${clean.replace(/"/g, '')}"','/install' -Verb RunAs -Wait`;
  await runSafe('powershell', ['-NoProfile', '-Command', ps], 30000);
  return { success: true, message: `Instalación UAC solicitada para ${path.basename(clean)}. Verifica el estado USB.` };
}
