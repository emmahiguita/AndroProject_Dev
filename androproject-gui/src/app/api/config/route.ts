import { NextResponse } from 'next/server';
import { ADB, ANDROPROJECT_BIN, FASTBOOT, ANDROPROJECT_HOME, SCREENSHOTS_DIR } from '@/lib/config';

export async function GET() {
  const turnServers: { url: string; username?: string; credential?: string }[] = [];

  // Leer TURN servers del entorno
  const turnRaw = process.env.TURN_SERVERS;
  if (turnRaw) {
    try {
      const parsed = JSON.parse(turnRaw);
      if (Array.isArray(parsed)) turnServers.push(...parsed);
    } catch { /* invalid JSON, skip */ }
  }

  // Fallback single TURN via env vars
  const turnUrl = process.env.TURN_SERVER_URL;
  if (turnUrl && !turnServers.some(s => s.url === turnUrl)) {
    turnServers.push({
      url: turnUrl,
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || '',
    });
  }

  return NextResponse.json({
    adb: ADB,
    streamingEngine: ANDROPROJECT_BIN,
    fastboot: FASTBOOT,
    home: ANDROPROJECT_HOME,
    capturesDir: SCREENSHOTS_DIR,
    wifiPort: 5555,
    apiPort: 3001,
    streamingWsPort: 3002,
    version: 'v3.0.0',

    // ── Remote connectivity ──
    turn: {
      servers: turnServers,
      // Si no hay TURN configurado, usar STUN público como fallback
      fallbackStun: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
      ],
    },
    // Tailscale IP si está disponible
    tailscaleIP: process.env.TAILSCALE_IP || null,
    // Cloudflare Tunnel URL si está configurado
    tunnelURL: process.env.CF_TUNNEL_URL || null,
  });
}
