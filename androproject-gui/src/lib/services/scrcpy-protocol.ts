// ============================================================================
// ARCHIVO: scrcpy-protocol.ts
// QUÉ HACE: Funciones puras de codificación/decodificación binaria para el
//           protocolo scrcpy v4.1 (frames H.264 + mensajes de control táctil).
// CÓMO FUNCIONA: Construye paquetes [8B ptsFlags + 4B size + payload] y
//           mensajes binarios SC_CONTROL_MSG_TYPE_INJECT_TOUCH_EVENT (32 bytes).
// POR QUÉ: Separar el protocolo binario de la gestión de procesos/sockets (SRP).
// ============================================================================

/** Empaqueta un frame H.264 con cabecera de 12 bytes [4B ptsHi + 4B ptsLo + 4B size]. */
export function packH264Frame(ptsHi: number, ptsLo: number, payload: Buffer): Buffer {
  const out = Buffer.allocUnsafe(12 + payload.length);
  out.writeUInt32BE(ptsHi >>> 0, 0);
  out.writeUInt32BE(ptsLo >>> 0, 4);
  out.writeUInt32BE(payload.length >>> 0, 8);
  payload.copy(out, 12);
  return out;
}

/** Detecta si un payload Annex-B H.264 corresponde a SPS/PPS (NAL 7) o IDR (NAL 5). */
export function classifyH264Payload(ptsHi: number, payload: Buffer): { isConfig: boolean; isKey: boolean } {
  const hasStartCode =
    payload.length >= 5 &&
    payload[0] === 0 &&
    payload[1] === 0 &&
    payload[2] === 0 &&
    payload[3] === 1;
  const nalType = hasStartCode ? payload[4] & 0x1f : 0;
  const isConfig = (ptsHi & 0x80000000) !== 0 || nalType === 7;
  const isKey = (ptsHi & 0x40000000) !== 0 || nalType === 5;
  return { isConfig, isKey };
}

/** Construye mensaje binario de 32 bytes para inyección táctil scrcpy (< 2ms). */
export function buildTouchPacket(
  action: 0 | 1 | 2,
  normX: number,
  normY: number,
  width: number,
  height: number,
): Buffer {
  const x = Math.max(0, Math.min(width - 1, Math.round(normX * width)));
  const y = Math.max(0, Math.min(height - 1, Math.round(normY * height)));
  const msg = Buffer.alloc(32);
  msg.writeUInt8(2, 0); // SC_CONTROL_MSG_TYPE_INJECT_TOUCH_EVENT
  msg.writeUInt8(action, 1); // 0=DOWN, 1=UP, 2=MOVE
  msg.writeUInt32BE(0xffffffff, 2); // POINTER_ID_MOUSE high 32 bits
  msg.writeUInt32BE(0xffffffff, 6); // POINTER_ID_MOUSE low 32 bits
  msg.writeInt32BE(x, 10);
  msg.writeInt32BE(y, 14);
  msg.writeUInt16BE(width, 18);
  msg.writeUInt16BE(height, 20);
  msg.writeUInt16BE(action === 1 ? 0 : 0xffff, 22);
  msg.writeUInt32BE(1, 24);
  msg.writeUInt32BE(action === 1 ? 0 : 1, 28);
  return msg;
}
