// ============================================================================
// ARCHIVO: projection-math.ts
// QUÉ HACE: Provee tipos compartidos y matemática pura para mapear coordenadas
//           del puntero del navegador a píxeles físicos reales del dispositivo.
// CÓMO FUNCIONA: Calcula el área útil (letterbox/aspect ratio) del viewport
//           considerando zoom y orientación (vertical/horizontal) sin efectos.
// POR QUÉ: Separar la geometría pura de los hooks de React (SRP, < 200L).
// ============================================================================

export interface ZoomState {
  scale: number;
  ox: number;
  oy: number;
}

export interface TouchRipple {
  id: number;
  x: number;
  y: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;

/** Limita un número al rango [lo, hi]. */
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Normaliza un valor al rango [0, 1]. */
export const clamp01 = (v: number): number => clamp(v, 0, 1);

/**
 * Convierte coordenadas (clientX, clientY) del navegador a coordenadas físicas
 * exactas (x, y) en la pantalla del móvil, compensando letterbox, zoom y rotación.
 */
export function mapClientToDeviceCoords(
  cx: number,
  cy: number,
  mediaEl: HTMLImageElement | HTMLCanvasElement | null,
  containerEl: HTMLElement | null,
  resolution: string | undefined,
  zoom: ZoomState,
): { x: number; y: number; devW: number; devH: number } | null {
  if (!containerEl) return null;

  const nw = mediaEl instanceof HTMLImageElement
    ? (mediaEl.naturalWidth || 1080)
    : (mediaEl?.width || 1080);
  const nh = mediaEl instanceof HTMLImageElement
    ? (mediaEl.naturalHeight || 2400)
    : (mediaEl?.height || 2400);

  // Extrae resolución física real (ej. "1080 × 2400") para mapeo 1:1
  const parts = (resolution || '')
    .split(/[×xX]/)
    .map((s) => parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  let devW = parts.length >= 2 ? parts[0] : nw;
  let devH = parts.length >= 2 ? parts[1] : nh;

  // Sincroniza ejes si el video rotó a horizontal o vertical
  if ((nw > nh && devW < devH) || (nh > nw && devH < devW)) {
    [devW, devH] = [devH, devW];
  }

  const rect = mediaEl?.getBoundingClientRect() || containerEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const na = nw / nh;
  const ba = rect.width / rect.height;
  const rw = ba > na ? rect.height * na : rect.width;
  const rh = ba > na ? rect.height : rect.width / na;
  const ox = (rect.width - rw) / 2;
  const oy = (rect.height - rh) / 2;
  if (rw <= 0 || rh <= 0) return null;

  const s = zoom.scale;
  const el = rect.left + ox;
  const et = rect.top + oy;
  const nx = s > 1 ? (cx - (el + zoom.ox * rw * (1 - s))) / (rw * s) : (cx - el) / rw;
  const ny = s > 1 ? (cy - (et + zoom.oy * rh * (1 - s))) / (rh * s) : (cy - et) / rh;

  if (!Number.isFinite(nx) || !Number.isFinite(ny) || nx < -0.05 || ny < -0.05 || nx > 1.05 || ny > 1.05) {
    return null;
  }
  return {
    x: clamp(Math.round(clamp01(nx) * devW), 0, devW - 1),
    y: clamp(Math.round(clamp01(ny) * devH), 0, devH - 1),
    devW,
    devH,
  };
}

export interface DevicePoint {
  x: number;
  y: number;
  devW: number;
  devH: number;
}

/** Calcula el payload de `input_swipe` para scroll por rueda del mouse. */
export function buildWheelSwipePayload(
  serial: string,
  p: DevicePoint,
  deltaX: number,
  deltaY: number,
): Record<string, unknown> {
  const steps = clamp(Math.round(Math.max(Math.abs(deltaX), Math.abs(deltaY)) / 60), 1, 6);
  const amt = 90 * steps;
  if (Math.abs(deltaY) >= Math.abs(deltaX)) {
    const d = deltaY > 0 ? 1 : -1;
    return {
      action: 'input_swipe', serial,
      x1: p.x, y1: clamp(p.y + d * amt, 0, p.devH),
      x2: p.x, y2: clamp(p.y - d * amt, 0, p.devH), duration: 160,
    };
  }
  const d = deltaX > 0 ? 1 : -1;
  return {
    action: 'input_swipe', serial,
    x1: clamp(p.x - d * amt, 0, p.devW), y1: p.y,
    x2: clamp(p.x + d * amt, 0, p.devW), y2: p.y, duration: 160,
  };
}

/** Calcula el payload de `input_swipe` para arrastre táctil si supera el umbral. */
export function buildDragSwipePayload(
  serial: string,
  a: DevicePoint,
  b: DevicePoint,
  minSwipePx = 8,
): Record<string, unknown> | null {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  if (dist < minSwipePx) return null;
  return {
    action: 'input_swipe', serial,
    x1: a.x, y1: a.y, x2: b.x, y2: b.y,
    duration: clamp(Math.round(dist * 1.2), 60, 600),
  };
}
