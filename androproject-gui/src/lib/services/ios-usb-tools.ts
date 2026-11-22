// ============================================================================
// ARCHIVO: ios-usb-tools.ts
// QUÉ HACE: Implementa operaciones USB/DVT de iOS vía `pymobiledevice3` y
//           `pnputil` (capturas HD, descubrimiento USB, listado de apps y túnel).
// CÓMO FUNCIONA: Evita duplicar procesos `pymobiledevice3 usbmux forward`
//           verificando si el proceso previo sigue activo, valida puertos y
//           limpia capturas vacías o corruptas en disco.
// POR QUÉ: Separar herramientas USB/CLI de la capa REST WDA mantiene
//           `ios-bridge.ts` < 200 líneas (SRP) y previene procesos zombis.
// ============================================================================

import { exec, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { SCREENSHOTS_DIR } from '@/lib/config';
import { wdaRequest, type IosDeviceInfo, type IosWdaStatus } from './ios-types';

const execAsync = promisify(exec);
let activeTunnelProc: ChildProcess | null = null;

export async function takeIosScreenshot(
  wdaBaseUrl: string,
  filename?: string,
): Promise<{ success: boolean; path?: string; error?: string }> {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const localPath = path.join(SCREENSHOTS_DIR, filename || `ios_screenshot_${timestamp}.png`);

  try {
    const res = await wdaRequest<{ value?: string }>(`${wdaBaseUrl}/screenshot`, { timeoutMs: 3000 });
    if (res.ok && typeof res.data?.value === 'string') {
      const buf = Buffer.from(res.data.value, 'base64');
      if (buf.length > 1000) {
        fs.writeFileSync(localPath, buf);
        return { success: true, path: localPath };
      }
    }
  } catch {}

  try {
    await execAsync(`python -m pymobiledevice3 developer dvt screenshot "${localPath}"`, {
      windowsHide: true, timeout: 6000,
    });
    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 1000) {
      return { success: true, path: localPath };
    }
    try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch {}
  } catch {}

  return {
    success: false,
    error: 'No se pudo capturar pantalla iOS. Conecta WDA en el puerto 8100 o usa AirPlay.',
  };
}

export async function listAppleUsbDevices(checkWdaStatus: () => Promise<IosWdaStatus>): Promise<IosDeviceInfo[]> {
  const list: IosDeviceInfo[] = [];
  try {
    const { stdout } = await execAsync('pnputil /enum-devices /connected /class USB', {
      windowsHide: true, timeout: 2000,
    });
    if (/VID_05AC/i.test(stdout)) {
      const wda = await checkWdaStatus();
      list.push({
        connectionType: 'USB',
        model: 'Apple iPhone / iPad',
        iosVersion: wda.iosVersion || 'iOS',
        wdaAvailable: wda.ready,
      });
    }
  } catch {}
  return list;
}

export async function listIosInstalledApps() {
  try {
    const { stdout } = await execAsync('python -m pymobiledevice3 apps list --color=false', {
      windowsHide: true, timeout: 10000, maxBuffer: 8 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as Record<
      string,
      { CFBundleDisplayName?: string; CFBundleName?: string; CFBundleShortVersionString?: string }
    >;
    const apps = Object.entries(parsed).map(([bundleId, meta]) => ({
      bundleId,
      name: meta?.CFBundleDisplayName || meta?.CFBundleName || bundleId,
      version: meta?.CFBundleShortVersionString,
    }));
    return { success: true, apps };
  } catch (err: unknown) {
    return {
      success: false,
      apps: [],
      error: err instanceof Error ? err.message : 'Conecta un iPhone por USB y confía en este PC.',
    };
  }
}

export async function startIosTunnel(
  wdaPort: number,
  checkWdaStatus: () => Promise<IosWdaStatus>,
): Promise<{ success: boolean; message: string; pid?: number }> {
  const port = Math.round(Number(wdaPort));
  if (!Number.isFinite(port) || port < 1024 || port > 65535) {
    return { success: false, message: 'Puerto de túnel inválido (1024-65535).' };
  }

  const wdaCheck = await checkWdaStatus();
  if (wdaCheck.ready) {
    return { success: true, message: `Túnel WDA ya activo en http://localhost:${port}` };
  }

  if (activeTunnelProc && activeTunnelProc.exitCode === null && !activeTunnelProc.killed && activeTunnelProc.pid) {
    return {
      success: true,
      message: `Túnel USB WDA ya en ejecución (PID: ${activeTunnelProc.pid})`,
      pid: activeTunnelProc.pid,
    };
  }

  try {
    const proc = spawn('python', ['-m', 'pymobiledevice3', 'usbmux', 'forward', String(port), String(port)], {
      detached: true, stdio: 'ignore', windowsHide: true,
    });
    proc.once('exit', () => { if (activeTunnelProc === proc) activeTunnelProc = null; });
    proc.once('error', () => { if (activeTunnelProc === proc) activeTunnelProc = null; });
    proc.unref();
    activeTunnelProc = proc;

    return {
      success: true,
      message: `Túnel USB WDA iniciado en http://localhost:${port} (PID: ${proc.pid})`,
      pid: proc.pid,
    };
  } catch {
    return {
      success: false,
      message: 'Para activar el túnel ejecuta: "pip install pymobiledevice3" y "pymobiledevice3 remote forward 8100 8100"',
    };
  }
}
