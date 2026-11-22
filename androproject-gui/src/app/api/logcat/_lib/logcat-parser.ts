// ============================================================================
// ARCHIVO: logcat-parser.ts
// QUÉ HACE: Define el tipo `LogcatEntry` y parsea líneas crudas de
//           `adb logcat -v threadtime` detectando cambios de app y crashes.
// CÓMO FUNCIONA: Aplica expresión regular threadtime, extrae tag/nivel/PID/TID
//           y clasifica eventos de ActivityTaskManager/WindowManager y
//           excepciones fatales, ANR o tombstones nativos.
// POR QUÉ: Separar el parser puro de la ruta SSE mantiene `logcat/route.ts`
//           por debajo de 200 líneas (SRP / Clean Architecture).
// ============================================================================

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

const LOGCAT_LINE_REGEX =
  /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+([^:]+?)\s*:\s*(.*)$/;

const APP_SWITCH_TAGS = new Set([
  'ActivityTaskManager',
  'ActivityManager',
  'WindowManager',
  'InputDispatcher',
  'TaskStackChangedListener',
]);

/** Parsea una línea de logcat (o continuación de stacktrace) en un `LogcatEntry`. */
export function parseLogcatLine(
  rawLine: string,
  lastEntry: LogcatEntry | null,
  counter: { val: number },
): LogcatEntry {
  const line = rawLine.trimEnd();
  const match = line.match(LOGCAT_LINE_REGEX);
  counter.val += 1;

  if (!match) {
    const isStackContinuation = Boolean(
      lastEntry?.isCrash ||
      line.startsWith('\tat ') ||
      line.startsWith('Caused by: ') ||
      line.startsWith('*** *** ***'),
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

  const [, timestamp, pid, tid, levelRaw, tagRaw, message] = match;
  const level = levelRaw as LogcatEntry['level'];
  const tag = tagRaw.trim();

  let isCrash = false;
  let isAppSwitch = false;
  let packageName: string | undefined;
  let activityName: string | undefined;

  if (APP_SWITCH_TAGS.has(tag)) {
    const hit =
      message.match(/Displayed\s+([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/) ||
      message.match(/START\s+u\d+\s+\{[^}]*cmp=([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/) ||
      message.match(/mResumedActivity:\s+ActivityRecord\{[^}]*\s+([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/) ||
      message.match(/mFocusedApp=.*([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/) ||
      message.match(/AppWindowToken\{.*([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/);
    if (hit) {
      isAppSwitch = true;
      packageName = hit[1];
      activityName = hit[2];
    }
  }

  if (
    level === 'E' || level === 'F' || tag === 'AndroidRuntime' ||
    tag === 'DEBUG' || tag === 'tombstoned' || tag.toLowerCase().includes('crash')
  ) {
    if (
      tag === 'DEBUG' || message.includes('FATAL EXCEPTION') || message.includes('Process:') ||
      message.includes('Exception') || message.includes('SIGSEGV') ||
      message.includes('SIGABRT') || message.includes('ANR in ')
    ) {
      isCrash = true;
    }
  }

  return {
    id: `${Date.now()}-${counter.val}`,
    timestamp, pid, tid, level, tag, message, raw: line,
    isCrash, isAppSwitch, packageName, activityName,
  };
}
