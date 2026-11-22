// ============================================================================
// ARCHIVO: scrcpy-args.ts
// QUÉ HACE: Define los tipos de configuración y construye el arreglo de
//           argumentos CLI para lanzar scrcpy en modo VisionNano (Direct3D11).
// CÓMO FUNCIONA: Normaliza serial, bitrate, FPS, tamaño máximo, buffer de
//           video (adaptado a Wi-Fi vs USB), puertos deterministas por serial
//           y flags opcionales (cámara, sin bordes, pantalla apagada).
// POR QUÉ: Separar la construcción pura de argumentos del ciclo de vida del
//           proceso mantiene scrcpy-engine.ts bajo 200 líneas (SRP / SOLID).
// ============================================================================

export interface VisionNanoOptions {
  serial: string;
  displayId?: number | string;
  maxSize?: number | string;
  maxFps?: number | string;
  bitRate?: string;
  videoCodec?: 'h264' | 'h265' | 'av1';
  turnScreenOff?: boolean;
  stayAwake?: boolean;
  alwaysOnTop?: boolean;
  borderless?: boolean;
  videoSource?: 'display' | 'camera';
  videoBuffer?: number | string;
  noAudio?: boolean;
}

export type ScrcpyEngineOptions = VisionNanoOptions;

export interface VisionNanoResult {
  success: boolean;
  alive: boolean;
  pid?: number;
  message?: string;
  error?: string;
}

export type ScrcpyStreamResult = VisionNanoResult;

export interface IVisionNanoEngine {
  buildArgs(options: VisionNanoOptions): string[];
  start(options: VisionNanoOptions): Promise<VisionNanoResult>;
  stop(serial: string): Promise<boolean>;
  checkAlive(serial: string): Promise<boolean>;
}

export type IScrcpyEngine = IVisionNanoEngine;

/**
 * Construye los argumentos CLI de scrcpy optimizados para baja latencia.
 * Calcula puertos y posición de ventana deterministas por serial para evitar
 * colisiones cuando hay múltiples dispositivos proyectando simultáneamente.
 */
export function buildVisionNanoArgs(options: VisionNanoOptions): string[] {
  const { serial } = options;
  const isWifi = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(serial);

  const bitRate = options.bitRate ? String(options.bitRate) : (isWifi ? '4M' : '16M');
  // Respeta '0' (resolución nativa) si se pasa explícitamente; usa 960 por defecto
  const maxSize = options.maxSize !== undefined && options.maxSize !== '' ? String(options.maxSize) : '960';
  const maxFps = options.maxFps ? String(options.maxFps) : (isWifi ? '30' : '60');
  const displayId = options.displayId !== undefined ? String(options.displayId) : '0';
  const codec = options.videoCodec || 'h264';
  // Wi-Fi requiere un pequeño buffer para evitar caídas por jitter de red
  const videoBuffer = options.videoBuffer !== undefined ? String(options.videoBuffer) : (isWifi ? '50' : '0');

  const args: string[] = ['-s', String(serial)];

  if (options.videoSource !== 'camera') {
    args.push(`--display-id=${displayId}`);
  }

  // Posición en cascada y rango de puertos deterministas por hash del serial
  const serialHash = Math.abs(String(serial).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  const offset = (serialHash + Number(displayId || 0) * 2) % 6;
  const wx = 100 + (offset * 80);
  const wy = 80 + (offset * 50);
  const portBase = 27180 + ((serialHash % 12) * 20);
  const portRange = `${portBase}:${portBase + 15}`;

  const windowTitle = options.videoSource === 'camera'
    ? `AndroProject — ${serial} (Cámara)`
    : `AndroProject — ${serial} (Display ${displayId})`;

  args.push(
    `--video-codec=${codec}`,
    '-b', bitRate,
    '--max-size', maxSize,
    `--max-fps=${maxFps}`,
    `--video-buffer=${videoBuffer}`,
    '--window-width=380',
    '--window-height=820',
    `--window-x=${wx}`,
    `--window-y=${wy}`,
    `--port=${portRange}`,
    `--window-title=${windowTitle}`,
  );

  if (options.noAudio !== false) args.push('--no-audio');
  if (options.borderless) args.push('--window-borderless');
  if (options.stayAwake !== false) args.push('--stay-awake');
  if (options.turnScreenOff) args.push('--turn-screen-off');
  if (options.alwaysOnTop) args.push('--always-on-top');
  if (options.videoSource === 'camera') {
    args.push('--video-source=camera', '--camera-facing=back');
  }

  return args;
}
