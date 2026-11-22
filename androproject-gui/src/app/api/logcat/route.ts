// ============================================================================
// ARCHIVO: route.ts (logcat SSE)
// QUÉ HACE: Expone el endpoint SSE `GET /api/logcat` para transmitir logs de
//           Android en tiempo real con detección inicial de app en foco.
// CÓMO FUNCIONA: Valida `serial` con `isValidDeviceSerial`, lanza `adb logcat`,
//           mantiene heartbeat cada 15s y limpia tanto el intervalo como el
//           subproceso `child` tanto en `abort` como en `cancel()`.
// POR QUÉ: Delegar el parser a `_lib/logcat-parser.ts` mantiene el archivo
//           < 200 líneas y corrige la fuga del timer `heartbeat` en `cancel()`.
// ============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';
import { isValidDeviceSerial } from '@/lib/security/input-sanitizer';
import { parseLogcatLine, type LogcatEntry } from './_lib/logcat-parser';

export type { LogcatEntry };

const execAsyncOrig = promisify(exec);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serial = searchParams.get('serial');
  const clearBuffer = searchParams.get('clear') === 'true';

  if (!serial || !isValidDeviceSerial(serial)) {
    return new Response(JSON.stringify({ error: 'Serial de dispositivo inválido o requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (clearBuffer) {
    try {
      const clearProc = spawn(ADB, ['-s', serial, 'logcat', '-c'], { windowsHide: true });
      await new Promise((resolve) => clearProc.on('close', resolve));
    } catch (err) {
      console.warn('[Logcat API] Error al limpiar buffer:', err);
    }
  }

  const child = spawn(ADB, ['-s', serial, 'logcat', '-v', 'threadtime'], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const encoder = new TextEncoder();
  const counter = { val: 0 };
  let lastEntry: LogcatEntry | null = null;
  let leftover = '';
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const cleanupResources = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (!child.killed) {
      try { child.kill(); } catch {}
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ serial, status: 'streaming' })}\n\n`),
      );

      execAsyncOrig(`"${ADB}" -s ${serial} shell "dumpsys window | grep -E mCurrentFocus"`, {
        encoding: 'utf8', timeout: 2500, windowsHide: true,
      }).then(({ stdout }) => {
        const match = String(stdout).match(/([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/);
        if (match && match[1] !== 'StatusBar' && match[1] !== 'NavigationBar') {
          const initEntry: LogcatEntry = {
            id: `init-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            pid: '0', tid: '0', level: 'I', tag: 'ActivityTaskManager',
            message: `App en primer plano: ${match[1]} (${match[2]})`,
            raw: `App en primer plano: ${match[1]} (${match[2]})`,
            isAppSwitch: true, packageName: match[1], activityName: match[2],
          };
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(initEntry)}\n\n`)); } catch {}
        }
      }).catch(() => {});

      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')); }
        catch { cleanupResources(); }
      }, 15000);

      child.stdout.on('data', (chunk: Buffer) => {
        const lines = (leftover + chunk.toString('utf-8')).split(/\r?\n/);
        leftover = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const entry = parseLogcatLine(line, lastEntry, counter);
          lastEntry = entry;
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`)); }
          catch { break; }
        }
      });

      child.stderr.on('data', (errChunk: Buffer) => {
        const errText = errChunk.toString('utf-8').trim();
        if (!errText) return;
        try {
          controller.enqueue(encoder.encode(`event: logcat_error\ndata: ${JSON.stringify({ error: errText })}\n\n`));
        } catch {}
      });

      child.on('close', (code) => {
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
        try {
          controller.enqueue(encoder.encode(`event: end\ndata: ${JSON.stringify({ exitCode: code })}\n\n`));
          controller.close();
        } catch {}
      });

      child.on('error', (err) => {
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
        try {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`));
          controller.close();
        } catch {}
      });

      req.signal.addEventListener('abort', cleanupResources, { once: true });
    },
    cancel: cleanupResources,
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
