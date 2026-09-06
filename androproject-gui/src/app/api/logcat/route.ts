/**
 * Logcat Streaming Endpoint (SSE - Server-Sent Events)
 *
 * Real-time Android logcat stream engine with:
 * - Direct multiplexed ADB streaming (independent from video socket)
 * - Intelligent line parser (Date, Time, PID, TID, Level, Tag, Message)
 * - Real-time App-Switch detector (ActivityTaskManager/WindowManager)
 * - Real-time Crash & Exception detector (Java/Kotlin Fatal, Native Tombstones, ANRs)
 * - Abort controller and clean orphan process garbage collection
 */
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';

const execAsync = promisify(exec);

export interface LogcatEntry {
  id: string;
  timestamp: string;
  pid: string;
  tid: string;
  level: 'V' | 'D' | 'I' | 'W' | 'E' | 'F' | 'S';
  tag: string;
  message: string;
  raw: string;
  isCrash?: boolean;
  isAppSwitch?: boolean;
  packageName?: string;
  activityName?: string;
}

const LOGCAT_LINE_REGEX = /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+([^:]+?)\s*:\s*(.*)$/;

function parseLogcatLine(rawLine: string, lastEntry: LogcatEntry | null, counter: { val: number }): LogcatEntry {
  const line = rawLine.trimEnd();
  const match = line.match(LOGCAT_LINE_REGEX);

  if (match) {
    const [_, timestamp, pid, tid, levelRaw, tagRaw, message] = match;
    const level = levelRaw as LogcatEntry['level'];
    const tag = tagRaw.trim();
    counter.val += 1;

    let isCrash = false;
    let isAppSwitch = false;
    let packageName: string | undefined;
    let activityName: string | undefined;

    // Detect App Switch / Foreground Launch (Android 8 - 15)
    if (
      tag === 'ActivityTaskManager' ||
      tag === 'ActivityManager' ||
      tag === 'WindowManager' ||
      tag === 'InputDispatcher' ||
      tag === 'TaskStackChangedListener'
    ) {
      const dispMatch = message.match(/Displayed\s+([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/);
      const startMatch = message.match(/START\s+u\d+\s+\{[^}]*cmp=([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/);
      const resumedMatch = message.match(/mResumedActivity:\s+ActivityRecord\{[^}]*\s+([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/);
      const focusMatch = message.match(/mFocusedApp=.*([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/);
      const tokenMatch = message.match(/AppWindowToken\{.*([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/);

      const hit = dispMatch || startMatch || resumedMatch || focusMatch || tokenMatch;
      if (hit) {
        isAppSwitch = true;
        packageName = hit[1];
        activityName = hit[2];
      }
    }

    // Detect Fatal Crash / Exceptions / ANRs
    if (
      level === 'E' ||
      level === 'F' ||
      tag === 'AndroidRuntime' ||
      tag === 'DEBUG' ||
      tag === 'tombstoned' ||
      tag.toLowerCase().includes('crash')
    ) {
      if (
        message.includes('FATAL EXCEPTION') ||
        message.includes('Process:') ||
        message.includes('Exception') ||
        message.includes('SIGSEGV') ||
        message.includes('SIGABRT') ||
        message.includes('ANR in ') ||
        tag === 'DEBUG'
      ) {
        isCrash = true;
      }
    }

    return {
      id: `${Date.now()}-${counter.val}`,
      timestamp,
      pid,
      tid,
      level,
      tag,
      message,
      raw: line,
      isCrash,
      isAppSwitch,
      packageName,
      activityName,
    };
  }

  // Multi-line Continuation (e.g. StackTrace / Tombstone continuation lines)
  counter.val += 1;
  const isStackContinuation = Boolean(
    lastEntry?.isCrash ||
    line.startsWith('\tat ') ||
    line.startsWith('Caused by: ') ||
    line.startsWith('*** *** ***')
  );

  return {
    id: `${Date.now()}-${counter.val}`,
    timestamp: lastEntry?.timestamp || new Date().toISOString().slice(11, 23),
    pid: lastEntry?.pid || '0',
    tid: lastEntry?.tid || '0',
    level: lastEntry?.level || (isStackContinuation ? 'E' : 'I'),
    tag: lastEntry?.tag || 'System',
    message: line,
    raw: line,
    isCrash: isStackContinuation,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serial = searchParams.get('serial');
  const clearBuffer = searchParams.get('clear') === 'true';

  if (!serial) {
    return new Response(JSON.stringify({ error: 'Serial de dispositivo requerido' }), {
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

  const logcatArgs = ['-s', serial, 'logcat', '-v', 'threadtime'];
  const child = spawn(ADB, logcatArgs, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const encoder = new TextEncoder();
  const counter = { val: 0 };
  let lastEntry: LogcatEntry | null = null;
  let leftover = '';

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ serial, status: 'streaming' })}\n\n`)
      );

      // Immediately detect current foreground app
      execAsync(`"${ADB}" -s ${serial} shell "dumpsys window | grep -E mCurrentFocus"`, { timeout: 2500 })
        .then(({ stdout }) => {
          const match = stdout.match(/([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/);
          if (match && match[1] !== 'StatusBar' && match[1] !== 'NavigationBar') {
            const initEntry: LogcatEntry = {
              id: `init-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              pid: '0',
              tid: '0',
              level: 'I',
              tag: 'ActivityTaskManager',
              message: `App en primer plano: ${match[1]} (${match[2]})`,
              raw: `App en primer plano: ${match[1]} (${match[2]})`,
              isAppSwitch: true,
              packageName: match[1],
              activityName: match[2],
            };
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(initEntry)}\n\n`));
            } catch {}
          }
        })
        .catch(() => {});

      // Heartbeat interval to prevent client timeout
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      child.stdout.on('data', (chunk: Buffer) => {
        const text = leftover + chunk.toString('utf-8');
        const lines = text.split(/\r?\n/);
        leftover = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const entry = parseLogcatLine(line, lastEntry, counter);
          lastEntry = entry;

          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
          } catch {
            // Controller closed
            break;
          }
        }
      });

      child.stderr.on('data', (errChunk: Buffer) => {
        const errText = errChunk.toString('utf-8').trim();
        if (errText) {
          try {
            controller.enqueue(
              encoder.encode(`event: logcat_error\ndata: ${JSON.stringify({ error: errText })}\n\n`)
            );
          } catch {}
        }
      });

      child.on('close', (code) => {
        clearInterval(heartbeat);
        try {
          controller.enqueue(
            encoder.encode(`event: end\ndata: ${JSON.stringify({ exitCode: code })}\n\n`)
          );
          controller.close();
        } catch {}
      });

      child.on('error', (err) => {
        clearInterval(heartbeat);
        try {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`)
          );
          controller.close();
        } catch {}
      });

      // Cleanup when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        if (!child.killed) {
          try {
            child.kill();
          } catch {}
        }
      });
    },

    cancel() {
      if (!child.killed) {
        try {
          child.kill();
        } catch {}
      }
    },
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
