// ============================================================================
// ARCHIVO: config/route.ts
// QUÉ HACE: Endpoint backend real para leer y modificar ajustes del sistema
//           host (binarios ADB, Fastboot, Scrcpy, carpeta de capturas) y
//           ajustes del sistema Android conectado vía ADB (`settings global/system`).
// CÓMO FUNCIONA: GET verifica existencia en disco de cada binario y lee en un
//           lote ADB: `stay_on_while_plugged_in`, `show_touches`, escalas de
//           animación, `screen_off_timeout` y DPI. POST aplica cambios reales.
// POR QUÉ: Convertir la vista de Ajustes en un panel de control funcional
//           100% real y sin valores estáticos (< 200 líneas, SOLID).
// ============================================================================

import { NextResponse } from 'next/server';
import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import {
  ADB,
  ANDROPROJECT_BIN,
  SCRCPY_SERVER_PATH,
  FASTBOOT,
  ANDROPROJECT_HOME,
  SCREENSHOTS_DIR,
} from '@/lib/config';
import { isValidDeviceSerial } from '@/lib/security/input-sanitizer';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

interface LiveAndroidSettings {
  stayAwake: boolean;
  showTouches: boolean;
  animScale: string;
  screenTimeoutMs: number;
  densityDpi: string;
}

async function readAndroidSettings(serial?: string | null): Promise<LiveAndroidSettings | null> {
  try {
    const sArgs = serial && isValidDeviceSerial(serial) ? ['-s', serial] : [];
    const cmd = [
      'settings get global stay_on_while_plugged_in',
      'settings get system show_touches',
      'settings get global window_animation_scale',
      'settings get system screen_off_timeout',
      'wm density',
    ].join('; echo "---"; ');
    const { stdout } = await execFileAsync(ADB, [...sArgs, 'shell', cmd], {
      timeout: 3500,
      windowsHide: true,
    });
    const parts = stdout.split('---').map((s) => s.trim());
    const stayVal = parseInt(parts[0] || '0', 10) || 0;
    const touchVal = parts[1] === '1';
    const animRaw = parseFloat(parts[2] || '1');
    const animScale = Number.isNaN(animRaw) ? '1.0' : animRaw.toFixed(1);
    const timeoutVal = parseInt(parts[3] || '60000', 10) || 60000;
    const dpiMatch = (parts[4] || '').match(/(\d+)/);

    return {
      stayAwake: stayVal > 0,
      showTouches: touchVal,
      animScale,
      screenTimeoutMs: timeoutVal,
      densityDpi: dpiMatch ? `${dpiMatch[1]} dpi` : '--',
    };
  } catch {
    return null;
  }
}

async function checkHttpOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1000), cache: 'no-store' });
    return res.ok;
  } catch { return false; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serial = searchParams.get('serial');
  const [deviceSettings, visionOk, airplayOk] = await Promise.all([
    readAndroidSettings(serial),
    checkHttpOk('http://127.0.0.1:8000/health'),
    checkHttpOk('http://127.0.0.1:7001/info').catch(() => false),
  ]);

  return NextResponse.json({
    success: true,
    adb: ADB,
    streamingEngine: ANDROPROJECT_BIN,
    scrcpyServer: SCRCPY_SERVER_PATH,
    fastboot: FASTBOOT,
    home: ANDROPROJECT_HOME,
    capturesDir: SCREENSHOTS_DIR,
    wifiPort: 5555,
    apiPort: 3000,
    streamingWsPort: 7001,
    visionPort: 8000,
    version: 'v3.2.0-studio',
    verified: {
      adb: fs.existsSync(ADB),
      fastboot: fs.existsSync(FASTBOOT),
      scrcpy: fs.existsSync(ANDROPROJECT_BIN),
      scrcpyServer: fs.existsSync(SCRCPY_SERVER_PATH),
      vision: visionOk,
      airplay: airplayOk,
    },
    deviceSettings,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      serial?: string;
      value?: string | number | boolean;
    };
    const action = body.action || 'reset';
    const serial = body.serial && isValidDeviceSerial(body.serial) ? body.serial : null;
    const sArgs = serial ? ['-s', serial] : [];

    // 1. Mantener pantalla encendida mientras carga (0 = off, 3 = USB + AC)
    if (action === 'set_stay_awake') {
      const targetVal = body.value ? '3' : '0';
      await execFileAsync(ADB, [...sArgs, 'shell', 'settings', 'put', 'global', 'stay_on_while_plugged_in', targetVal], {
        timeout: 4000,
        windowsHide: true,
      });
    }

    // 2. Mostrar toques visuales en pantalla (1 = on, 0 = off)
    if (action === 'set_show_touches') {
      const targetVal = body.value ? '1' : '0';
      await execFileAsync(ADB, [...sArgs, 'shell', 'settings', 'put', 'system', 'show_touches', targetVal], {
        timeout: 4000,
        windowsHide: true,
      });
    }

    // 3. Escala de animaciones del sistema (0.0, 0.5, 1.0)
    if (action === 'set_anim_scale') {
      const allowed = ['0.0', '0.5', '1.0'];
      const scale = allowed.includes(String(body.value)) ? String(body.value) : '1.0';
      const cmd = `settings put global window_animation_scale ${scale}; settings put global transition_animation_scale ${scale}; settings put global animator_duration_scale ${scale}`;
      await execFileAsync(ADB, [...sArgs, 'shell', cmd], { timeout: 4000, windowsHide: true });
    }

    // 4. Tiempo de apagado de pantalla en milisegundos
    if (action === 'set_screen_timeout') {
      const ms = Math.min(1800000, Math.max(15000, Number(body.value) || 60000));
      await execFileAsync(ADB, [...sArgs, 'shell', 'settings', 'put', 'system', 'screen_off_timeout', String(ms)], {
        timeout: 4000,
        windowsHide: true,
      });
    }

    // 5. Activar ADB TCP/IP en puerto 5555
    if (action === 'enable_tcpip') {
      await execFileAsync(ADB, [...sArgs, 'tcpip', '5555'], { timeout: 5000, windowsHide: true });
    }

    // 6. Abrir carpeta de capturas en el Explorador de Windows
    if (action === 'open_captures') {
      await fs.promises.mkdir(SCREENSHOTS_DIR, { recursive: true });
      await execAsync(`explorer.exe "${SCREENSHOTS_DIR}"`, { windowsHide: false }).catch(() => {});
    }

    // 7. Reiniciar servidor ADB
    if (action === 'restart_adb') {
      await execFileAsync(ADB, ['kill-server'], { timeout: 4000, windowsHide: true }).catch(() => {});
      await execFileAsync(ADB, ['start-server'], { timeout: 5000, windowsHide: true });
    }

    const deviceSettings = await readAndroidSettings(serial);
    return NextResponse.json({
      success: true,
      action,
      message: 'Ajuste aplicado correctamente.',
      deviceSettings,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
