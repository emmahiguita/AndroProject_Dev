// ============================================================================
// ARCHIVO: api/ios/route.ts
// QUÉ HACE: Endpoint unificado de control y automatización de iPhone/iPad desde
//           Windows (WDA REST 8100, túnel USB pymobiledevice3, AirPlay 2 y
//           emparejamiento Bluetooth HID / AssistiveTouch).
// CÓMO FUNCIONA: Resuelve IIosBridge e IAirPlayReceiverEngine vía ServiceContainer
//           (DIP) y despacha acciones en < 10ms.
// POR QUÉ: Permitir proyectar y controlar iOS en 1 clic desde AndroProject.
// ============================================================================
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { container, TOKENS, type IIosBridge, type IAirPlayReceiverEngine } from '@/core';

function getIosBridge(): IIosBridge {
  return container.resolve<IIosBridge>(TOKENS.IosBridge);
}

function getAirPlay(): IAirPlayReceiverEngine {
  return container.resolve<IAirPlayReceiverEngine>(TOKENS.AirPlayEngine);
}

export async function GET() {
  try {
    const ios = getIosBridge();
    const airplay = getAirPlay();
    const [wda, usbDevices, airplayStatus] = await Promise.all([
      ios.checkWdaStatus(),
      ios.listUsbDevices(),
      airplay.getStatus(),
    ]);

    return NextResponse.json(
      { success: true, wda, usbDevices, airplay: airplayStatus },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ios = getIosBridge();
    const airplay = getAirPlay();
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || 'status');

    switch (action) {
      case 'start_tunnel': {
        const port = Number(body.port) || 8100;
        const res = await ios.startTunnel(port);
        return NextResponse.json(res);
      }

      case 'start_airplay': {
        const status = await airplay.start({ audioEnabled: Boolean(body.audioEnabled) });
        return NextResponse.json({ success: true, message: 'Receptor AirPlay 2 activo', status });
      }

      case 'open_bluetooth_settings': {
        exec('start ms-settings:bluetooth', { windowsHide: true });
        return NextResponse.json({
          success: true,
          message: 'Ajustes Bluetooth de Windows abiertos. Activa AssistiveTouch en tu iPhone y empareja.',
        });
      }

      case 'tap': {
        const res = await ios.tap(Number(body.x), Number(body.y));
        return NextResponse.json(res);
      }

      case 'swipe': {
        const res = await ios.swipe(
          Number(body.x1),
          Number(body.y1),
          Number(body.x2),
          Number(body.y2),
          Number(body.duration) || 220,
        );
        return NextResponse.json(res);
      }

      case 'text': {
        const res = await ios.typeText(String(body.text || ''));
        return NextResponse.json(res);
      }

      case 'button': {
        const btn = String(body.button || 'home') as 'home' | 'volumeUp' | 'volumeDown' | 'lock';
        const res = await ios.pressButton(btn);
        return NextResponse.json(res);
      }

      case 'screenshot': {
        const res = await ios.takeScreenshot();
        return NextResponse.json(res);
      }

      case 'launch_app': {
        const res = await ios.launchApp(String(body.bundleId || ''));
        return NextResponse.json(res);
      }

      case 'list_apps': {
        const res = await ios.listInstalledApps();
        return NextResponse.json(res);
      }

      case 'open_url': {
        const res = await ios.openUrl(String(body.url || ''));
        return NextResponse.json(res);
      }

      default: {
        const wda = await ios.checkWdaStatus();
        return NextResponse.json({ success: true, wda });
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
