/**
 * /api/airplay — iOS AirPlay 2 Receiver Control Endpoint
 */
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { airPlayReceiverEngine } from '@/lib/services/airplay-engine';

export async function GET() {
  try {
    const status = await airPlayReceiverEngine.getStatus();
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
    const body = await request.json();
    const action = body.action || 'status';

    switch (action) {
      case 'start': {
        const status = await airPlayReceiverEngine.start({
          serverName: body.serverName,
          port: body.port,
          pinRequired: body.pinRequired,
          pinCode: body.pinCode,
          maxFps: body.maxFps,
          audioEnabled: body.audioEnabled,
        });
        return NextResponse.json({ success: true, message: 'Servidor AirPlay iniciado', status });
      }

      case 'stop': {
        const stopped = await airPlayReceiverEngine.stop();
        return NextResponse.json({ success: true, message: 'Servidor AirPlay detenido', stopped });
      }

      case 'set_name': {
        const updated = await airPlayReceiverEngine.setServerName(body.name);
        return NextResponse.json({ success: updated, message: updated ? 'Nombre Bonjour actualizado' : 'Nombre no válido' });
      }

      case 'set_pin': {
        const updated = await airPlayReceiverEngine.setPin(body.pin);
        return NextResponse.json({ success: updated, message: 'PIN actualizado' });
      }

      case 'register_test_client': {
        airPlayReceiverEngine.registerClient(
          body.clientIp || '192.168.0.25',
          body.clientName || 'iPhone 16 Pro',
          body.model || 'iPhone 16 Pro',
        );
        return NextResponse.json({ success: true, message: 'Cliente AirPlay registrado' });
      }

      default: {
        const status = await airPlayReceiverEngine.getStatus();
        return NextResponse.json({ success: true, status });
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
