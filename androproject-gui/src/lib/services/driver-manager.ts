// ============================================================================
// ARCHIVO: driver-manager.ts
// QUÉ HACE: Diagnóstico y gestión segura de drivers USB Windows (PnPUtil),
//           separando incidencias móviles por VID/PID, verificando firma `.cat`
//           antes de instalar `.inf` y comprobando exitCode real tras UAC.
// CÓMO FUNCIONA: Ejecuta `pnputil`, `adb` y `fastboot` conservando `exitCode`
//           y `stderr`; pasa rutas a PowerShell vía `env` (sin interpolación).
// POR QUÉ: Evitar falsos positivos de éxito en UAC e inyección de rutas (<200L).
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
  mobileProblems: WindowsUsbEntry[];
  otherProblemsCount: number;
  adbDevices: string[];
  fastbootDevices: string[];
}

export interface CmdOutcome {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runSafe(bin: string, args: string[], timeout = 4000, extraEnv?: Record<string, string>): Promise<CmdOutcome> {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout,
      maxBuffer: 6 * 1024 * 1024,
      windowsHide: true,
      env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
    });
    return { ok: true, exitCode: 0, stdout: String(stdout || ''), stderr: String(stderr || '') };
  } catch (err: unknown) {
    const e = err as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    const exitCode = typeof e.code === 'number' ? e.code : 1;
    return { ok: false, exitCode, stdout: String(e.stdout || ''), stderr: String(e.stderr || e.message || '') };
  }
}

function parsePnpBlocks(raw: string): WindowsUsbEntry[] {
  const pick = (b: string, re: RegExp) => b.match(re)?.[1]?.trim() || '';
  return raw.split(/\r?\n\r?\n/).reduce<WindowsUsbEntry[]>((acc, b) => {
    const instanceId = pick(b, /(?:Instance ID|Id\. de instancia):\s*(.+)/i);
    if (!instanceId) return acc;
    acc.push({
      instanceId,
      description: pick(b, /(?:Device Description|Descripci[óo]n del dispositivo):\s*(.+)/i),
      className: pick(b, /(?:Class Name|Nombre de clase):\s*(.+)/i),
      driverInf: pick(b, /(?:Driver Name|Nombre del controlador):\s*(.+)/i),
      status: pick(b, /(?:Status|Estado):\s*(.+)/i),
      problemCode: pick(b, /(?:Problem Code|C[óo]digo del problema):\s*(.+)/i),
      hardwareId: pick(b, /(?:Hardware IDs|Id\. de hardware):\s*(.+)/i),
    });
    return acc;
  }, []);
}

const MOBILE_USB_RE = /VID_(05AC|04E8|22D9|18D1|2717|12D1|0BB4|2A70|0E8D)|Android|ADB|Fastboot|Apple|SAMSUNG|OPPO|MediaTek|Qualcomm/i;
const isMobileUsb = (d: WindowsUsbEntry) =>
  MOBILE_USB_RE.test(d.instanceId) || MOBILE_USB_RE.test(d.description) || MOBILE_USB_RE.test(d.hardwareId);

/** Escanea drivers USB móviles conectados, incidencias PnP y estado ADB/Fastboot. */
export async function scanWindowsDrivers(): Promise<DriverScanReport> {
  const [conn, prob, adbRes, fbRes] = await Promise.all([
    runSafe('pnputil', ['/enum-devices', '/connected', '/deviceids']),
    runSafe('pnputil', ['/enum-devices', '/problem', '/deviceids']),
    runSafe(ADB, ['devices', '-l']),
    runSafe(FASTBOOT, ['devices']),
  ]);

  const mobileUsb = parsePnpBlocks(conn.stdout).filter(isMobileUsb);
  const allProblems = parsePnpBlocks(prob.stdout);
  const mobileProblems = allProblems.filter(isMobileUsb);
  const adbDevices = adbRes.stdout.split('\n').slice(1).map((l) => l.trim()).filter(Boolean);
  const fastbootDevices = fbRes.stdout.split('\n').map((l) => l.trim()).filter((l) => l.includes('fastboot'));

  return {
    mobileUsb,
    mobileProblems,
    otherProblemsCount: Math.max(0, allProblems.length - mobileProblems.length),
    adbDevices,
    fastbootDevices,
  };
}

/** Valida firma Authenticode de un `.cat` usando variable de entorno (cero inyección). */
export async function verifyCatalogSignature(catPath: string): Promise<{ valid: boolean; status: string; exitCode: number }> {
  const clean = path.resolve(catPath.trim());
  if (!path.isAbsolute(clean) || !clean.toLowerCase().endsWith('.cat')) {
    throw new Error('Ruta .cat inválida.');
  }
  await fs.access(clean);
  const res = await runSafe(
    'powershell',
    ['-NoProfile', '-Command', '(Get-AuthenticodeSignature -LiteralPath $env:DRIVER_CAT_PATH).Status'],
    6000,
    { DRIVER_CAT_PATH: clean },
  );
  const status = res.stdout.trim() || res.stderr.trim() || 'Unknown';
  return { valid: status === 'Valid', status, exitCode: res.exitCode };
}

/** Instala un `.inf` OEM tras validar que exista y comprobar su `.cat` asociado si está presente. */
export async function installInfDriver(infPath: string): Promise<{
  success: boolean; exitCode: number; message: string; catalogStatus?: string;
}> {
  const clean = path.resolve(infPath.trim());
  if (!path.isAbsolute(clean) || !clean.toLowerCase().endsWith('.inf')) {
    throw new Error('Debe indicar una ruta absoluta .inf válida.');
  }
  await fs.access(clean);

  const catCandidate = clean.slice(0, -4) + '.cat';
  let catalogStatus = 'Sin .cat en carpeta';
  try {
    await fs.access(catCandidate);
    const sig = await verifyCatalogSignature(catCandidate);
    catalogStatus = sig.status;
    if (!sig.valid) {
      return { success: false, exitCode: 1, catalogStatus, message: `Instalación bloqueada: firma de catálogo no válida (${sig.status}).` };
    }
  } catch { /* Si el .cat tiene otro nombre, Windows igualmente validará la firma del paquete */ }

  const direct = await runSafe('pnputil', ['/add-driver', clean, '/install'], 15000);
  if (direct.exitCode === 0 || direct.exitCode === 3010) {
    return { success: true, exitCode: direct.exitCode, catalogStatus, message: (direct.stdout || 'Driver instalado').trim() };
  }

  // Elevación UAC segura vía $env:DRIVER_INF_PATH y propagación real de $p.ExitCode
  const psScript = '$p = Start-Process -FilePath pnputil -ArgumentList @("/add-driver",$env:DRIVER_INF_PATH,"/install") -Verb RunAs -Wait -PassThru; exit $p.ExitCode';
  const uac = await runSafe('powershell', ['-NoProfile', '-Command', psScript], 45000, { DRIVER_INF_PATH: clean });
  const ok = uac.exitCode === 0 || uac.exitCode === 3010;
  return {
    success: ok,
    exitCode: uac.exitCode,
    catalogStatus,
    message: ok
      ? `Driver ${path.basename(clean)} instalado con elevación UAC (código ${uac.exitCode}).`
      : `Falló instalación UAC (exitCode ${uac.exitCode}): ${uac.stderr || 'Cancelado o rechazado por Windows.'}`,
  };
}
