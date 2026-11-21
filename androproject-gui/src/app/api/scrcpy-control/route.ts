// ============================================================================
// ARCHIVO: scrcpy-control/route.ts
// QUÉ HACE: Inyecta eventos táctiles binarios (DOWN/MOVE/UP) en < 2ms directos
//           al socket de control de scrcpy-server v4.1.
// CÓMO FUNCIONA: Recibe coordenadas normalizadas [0..1] y acción (0,1,2) y
//           escribe el paquete de 32 bytes al socket TCP persistente.
// POR QUÉ: Eliminar los 475ms de latencia de `adb shell input` para lograr
//           movilidad táctil 100% sincronizada con el video a 60 FPS.
// ============================================================================
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { injectScrcpyTouch } from '@/lib/services/scrcpy-session-hub';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      serial?: string;
      action?: number;
      nx?: number;
      ny?: number;
    };
    const serial = body.serial || '';
    const action = body.action;
    const nx = Number(body.nx);
    const ny = Number(body.ny);

    if (!serial || (action !== 0 && action !== 1 && action !== 2) || !Number.isFinite(nx) || !Number.isFinite(ny)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const ok = injectScrcpyTouch(serial, action, nx, ny);
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
