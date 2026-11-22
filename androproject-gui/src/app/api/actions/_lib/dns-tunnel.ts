// ============================================================================
// ARCHIVO: dns-tunnel.ts
// QUÉ HACE: Configura, inicia, detiene y consulta el estado de un túnel DNS
//           (`dns2tcp`) sobre Android vía ADB.
// CÓMO FUNCIONA: Valida dominio y clave con regex estricto (anti-inyección),
//           escribe `/data/local/tmp/dns2tcpd.conf` en el dispositivo y
//           administra el proxy local `127.0.0.1:2080`.
// POR QUÉ: Separar el túnel DNS de `network.ts` cumple SRP (< 200 líneas) y
//           corrige el bug que ejecutaba `pkg/apt` en el host Windows.
// ============================================================================

import { NextResponse } from 'next/server';
import { safeExec } from './helpers';
import type { ActionContext } from './context';

const SAFE_HOSTNAME_RE = /^[a-zA-Z0-9.-]{1,253}$/;
const SAFE_KEY_RE = /^[a-zA-Z0-9_.-]{1,128}$/;

/** Instala/configura `dns2tcp` dentro del dispositivo Android (nunca en el host). */
export async function dnsTunnelSetup(ctx: ActionContext, body: { domain: string; key: string }) {
  const domain = String(body.domain ?? '').trim();
  const key = String(body.key ?? '').trim();
  if (!SAFE_HOSTNAME_RE.test(domain) || !SAFE_KEY_RE.test(key)) {
    return NextResponse.json({ success: false, error: 'Dominio o clave con caracteres no permitidos' }, { status: 400 });
  }

  const r = await safeExec(
    `${ctx.adbTarget} shell "su -c 'apt update && apt install -y dns2tcp' 2>/dev/null || which dns2tcpc"`,
    30000,
  );
  if (!r.ok) {
    return NextResponse.json({ success: false, error: `Instalación fallida: ${r.err}. Requiere root/Termux con dns2tcp.` });
  }

  const config = `listen = 127.0.0.1\nport = 2080\nuser = nobody\ndomain = ${domain}\nkey = ${key}\n`;
  const r2 = await safeExec(`${ctx.adbTarget} shell "printf '%s' '${config}' > /data/local/tmp/dns2tcpd.conf"`);
  return NextResponse.json({ success: r2.ok, message: r2.ok ? 'dns2tcp instalado y configurado' : r2.err });
}

/** Inicia `dns2tcpc` en segundo plano en Android y apunta el proxy HTTP a :2080. */
export async function dnsTunnelStart(ctx: ActionContext) {
  const r = await safeExec(
    `${ctx.adbTarget} shell "dns2tcpc -f /data/local/tmp/dns2tcpd.conf > /data/local/tmp/dns2tcp.log 2>&1 &"`,
  );
  if (r.ok) {
    await safeExec(`${ctx.adbTarget} shell settings put global http_proxy 127.0.0.1:2080`);
  }
  return NextResponse.json({ success: r.ok, message: r.ok ? 'Túnel DNS iniciado (SOCKS5 en :2080)' : r.err });
}

/** Detiene `dns2tcpc` y limpia el proxy HTTP global de Android. */
export async function dnsTunnelStop(ctx: ActionContext) {
  const r1 = await safeExec(`${ctx.adbTarget} shell "pkill -f dns2tcpc"`);
  const r2 = await safeExec(`${ctx.adbTarget} shell settings put global http_proxy :0`);
  const ok = r1.ok || r2.ok;
  return NextResponse.json({ success: ok, message: ok ? 'Túnel DNS detenido' : r1.err });
}

/** Consulta si `dns2tcpc` está corriendo y devuelve el proxy configurado. */
export async function dnsTunnelStatus(ctx: ActionContext) {
  const r = await safeExec(`${ctx.adbTarget} shell "pgrep -f dns2tcpc && echo running || echo stopped"`);
  const running = (r.out || '').trim().includes('running');
  const proxy = await safeExec(`${ctx.adbTarget} shell settings get global http_proxy`);
  return NextResponse.json({
    success: true,
    running,
    proxy: (proxy.out || '').trim(),
    pid: (r.out || '').trim().split('\n')[0] || null,
  });
}
