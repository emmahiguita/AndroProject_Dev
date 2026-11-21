/**
 * /api/airplay — iOS AirPlay 2 Receiver Control Endpoint
 */
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { container, TOKENS, IAirPlayReceiverEngine } from '@/core';

function getAirPlayEngine(): IAirPlayReceiverEngine {
  return container.resolve<IAirPlayReceiverEngine>(TOKENS.AirPlayEngine);
}

export async function GET() {
  try {
    const engine = getAirPlayEngine();
    const status = await engine.getStatus();
    return NextResponse.json({
      success: true,
      status,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const engine = getAirPlayEngine();
    const body = await request.json();
    const action = body.action || 'status';

    switch (action) {
      case 'start': {
        const status = await engine.start({
          serverName: body.serverName,
          port: body.port,
          pinRequired: body.pinRequired,
          pinCode: body.pinCode,
          maxFps: body.maxFps,
          audioEnabled: body.audioEnabled !== undefined ? Boolean(body.audioEnabled) : undefined,
        });
        return NextResponse.json({
          success: true,
          message: status.audioEnabled
            ? 'Servidor AirPlay iniciado (Audio en PC Opcional activado)'
            : 'Servidor AirPlay iniciado (Audio en Celular por defecto)',
          status,
        });
      }

      case 'set_audio': {
        const status = await engine.setAudioEnabled(Boolean(body.audioEnabled));
        return NextResponse.json({
          success: true,
          message: status.audioEnabled
            ? 'Audio en PC (Opcional) activado'
            : 'Audio en Celular (Por defecto) activado',
          status,
        });
      }

      case 'stop': {
        const stopped = await engine.stop();
        return NextResponse.json({ success: true, message: 'Servidor AirPlay detenido', stopped });
      }

      case 'set_name': {
        const updated = await engine.setServerName(body.name);
        return NextResponse.json({ success: updated, message: updated ? 'Nombre Bonjour actualizado' : 'Nombre no válido' });
      }

      case 'set_pin': {
        const updated = await engine.setPin(body.pin);
        return NextResponse.json({ success: updated, message: 'PIN actualizado' });
      }

      case 'open_native_window':
      case 'focus_window': {
        const launched = await engine.openNativeWindow();
        return NextResponse.json({
          success: launched,
          message: launched ? 'Ventana nativa Direct3D11 abierta en el escritorio' : 'No se pudo abrir la ventana',
        });
      }

      case 'toggle_mouse_control': {
        const res = engine.toggleMouseControl();
        return NextResponse.json(res);
      }

      case 'register_test_client': {
        engine.registerClient(
          body.clientIp || '192.168.0.25',
          body.clientName || 'iPhone 16 Pro',
          body.model || 'iPhone 16 Pro',
        );
        return NextResponse.json({ success: true, message: 'Cliente AirPlay registrado' });
      }

      default: {
        const status = await engine.getStatus();
        return NextResponse.json({ success: true, status });
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
