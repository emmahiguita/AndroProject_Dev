// ============================================================================
// ARCHIVO: ai-cli/route.ts
// QUÉ HACE: Hub real de inyección CLI / IA local (Ollama/Llama, ADB Shell y
//           herramientas CLI locales como Antigravity/Claude/Gemini/Python).
// CÓMO FUNCIONA: GET descubre en vivo los modelos Ollama (`127.0.0.1:11434`)
//           y CLIs disponibles; POST ejecuta inferencia Ollama o comandos
//           validados sin shell (`execFile`) con sanitización estricta.
// POR QUÉ: Permitir inyectar prompts y automatizaciones reales desde el estudio
//           sin simulaciones y bloqueando inyección de comandos maliciosos.
// ============================================================================

import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ADB } from '@/lib/config';
import { isValidDeviceSerial } from '@/lib/security/input-sanitizer';

const execFileAsync = promisify(execFile);
const OLLAMA_BASE = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const SHELL_META_RE = /[;&|`$><\r\n]/;

/** Comprueba si un ejecutable CLI responde en el sistema local. */
async function checkCli(bin: string, arg = '--version'): Promise<boolean> {
  try {
    await execFileAsync(bin, [arg], { timeout: 2000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/** GET /api/ai-cli — Descubre modelos Ollama reales y CLIs disponibles. */
export async function GET() {
  let ollamaOnline = false;
  let models: string[] = [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      ollamaOnline = true;
      const data = (await res.json()) as { models?: { name: string }[] };
      models = (data.models || []).map((m) => m.name);
    }
  } catch {
    ollamaOnline = false;
  }

  const [adbOk, ollamaCli, pythonOk, claudeOk, geminiOk] = await Promise.all([
    checkCli(ADB, 'version'),
    checkCli('ollama', '--version'),
    checkCli('python', '--version'),
    checkCli('claude', '--version'),
    checkCli('gemini', '--version'),
  ]);

  return NextResponse.json({
    success: true,
    ollama: { online: ollamaOnline, host: OLLAMA_BASE, models },
    clis: { adb: adbOk, ollama: ollamaCli, python: pythonOk, claude: claudeOk, gemini: geminiOk },
  });
}

/** POST /api/ai-cli — Ejecuta inferencia real Ollama/Llama o comando CLI/ADB seguro. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      mode?: 'ollama' | 'adb' | 'cli';
      prompt?: string;
      model?: string;
      serial?: string;
      deviceContext?: string;
    };

    const mode = body.mode || 'ollama';
    const prompt = (body.prompt || '').trim();
    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt o comando vacío.' }, { status: 400 });
    }

    // 1. Inferencia real con Ollama / Llama local
    if (mode === 'ollama') {
      const model = (body.model || 'llama3.2').trim();
      const fullPrompt = body.deviceContext
        ? `Contexto del dispositivo conectado:\n${body.deviceContext}\n\nSolicitud del usuario:\n${prompt}`
        : prompt;

      const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: fullPrompt, stream: false }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return NextResponse.json(
          { success: false, error: `Ollama respondió HTTP ${res.status}: ${errText || 'Verifica que el modelo exista.'}` },
          { status: 502 }
        );
      }

      const data = (await res.json()) as { response?: string; total_duration?: number };
      return NextResponse.json({
        success: true,
        output: data.response || '',
        meta: { provider: 'ollama', model, durationMs: Math.round((data.total_duration || 0) / 1e6) },
      });
    }

    // 2. Comando ADB Shell validado (sin metacaracteres de inyección)
    if (mode === 'adb') {
      if (SHELL_META_RE.test(prompt)) {
        return NextResponse.json(
          { success: false, error: 'Comando bloqueado: contiene metacaracteres de shell no permitidos.' },
          { status: 400 }
        );
      }
      const serialArgs = body.serial && isValidDeviceSerial(body.serial) ? ['-s', body.serial] : [];
      const tokens = prompt.split(/\s+/).filter(Boolean);
      const args = tokens[0] === 'adb' ? [...serialArgs, ...tokens.slice(1)] : [...serialArgs, 'shell', ...tokens];

      const { stdout, stderr } = await execFileAsync(ADB, args, {
        timeout: 12000,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      });
      return NextResponse.json({
        success: true,
        output: (stdout || stderr || '(sin salida)').trim(),
        meta: { provider: 'adb', args: args.join(' ') },
      });
    }

    // 3. Ejecución CLI segura (allowlist de binarios: ollama, claude, gemini, python, adb)
    const ALLOWED_BINS: Record<string, string> = {
      adb: ADB,
      ollama: 'ollama',
      claude: 'claude',
      gemini: 'gemini',
      python: 'python',
    };

    if (SHELL_META_RE.test(prompt)) {
      return NextResponse.json(
        { success: false, error: 'Metacaracteres de shell bloqueados por seguridad.' },
        { status: 400 }
      );
    }

    const parts = prompt.split(/\s+/).filter(Boolean);
    const binKey = parts[0]?.toLowerCase() || '';
    const resolvedBin = ALLOWED_BINS[binKey];
    if (!resolvedBin) {
      return NextResponse.json(
        { success: false, error: `CLI "${binKey}" no permitido. Usa: ${Object.keys(ALLOWED_BINS).join(', ')}.` },
        { status: 400 }
      );
    }

    const { stdout, stderr } = await execFileAsync(resolvedBin, parts.slice(1), {
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
    return NextResponse.json({
      success: true,
      output: (stdout || stderr || '(completado sin salida)').trim(),
      meta: { provider: binKey },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
