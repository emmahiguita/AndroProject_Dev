// ============================================================================
// ARCHIVO: ai-cli/route.ts
// QUÉ HACE: Hub backend para IA local y comandos CLI reales: Claude Code
//           (DeepSeek), Ollama/Llama local, ADB Shell nativo y herramientas CLI.
// CÓMO FUNCIONA: Ejecuta binarios nativos directos (.exe / node) evitando wrappers
//           .cmd para máxima seguridad y cero 'spawn EINVAL' en Windows.
// POR QUÉ: Inferencia real conversacional y de código, rápida y sin simulaciones.
// ============================================================================

import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { ADB } from '@/lib/config';
import { isValidDeviceSerial } from '@/lib/security/input-sanitizer';
import { generateContextSuggestions } from '@/features/cli/cli-suggestions';

const execFileAsync = promisify(execFile);
const OLLAMA_BASE = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const SHELL_META_RE = /[;&|`$><\r\n]/;

const NPM_DIR = path.join(process.env.APPDATA || '', 'npm');
const CLAUDE_EXE = path.join(NPM_DIR, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
const GEMINI_JS = path.join(NPM_DIR, 'node_modules', '@google', 'gemini-cli', 'bundle', 'gemini.js');
const OLLAMA_EXE = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe');

async function checkBin(bin: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(bin, args, { timeout: 2500, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  let ollamaOnline = false;
  let models: string[] = [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      ollamaOnline = true;
      const data = (await res.json()) as { models?: { name: string }[] };
      models = (data.models || []).map((m) => m.name);
    }
  } catch { ollamaOnline = false; }

  const [adbOk, claudeOk, pythonOk, geminiOk] = await Promise.all([
    checkBin(ADB, ['version']),
    fs.existsSync(CLAUDE_EXE) ? Promise.resolve(true) : checkBin('claude', ['--version']),
    checkBin('python', ['--version']),
    fs.existsSync(GEMINI_JS) ? Promise.resolve(true) : checkBin('gemini', ['--version']),
  ]);

  return NextResponse.json({
    success: true,
    ollama: { online: ollamaOnline, host: OLLAMA_BASE, models, binary: fs.existsSync(OLLAMA_EXE) },
    clis: { claude: claudeOk, adb: adbOk, python: pythonOk, gemini: geminiOk, ollama: true },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      mode?: 'claude' | 'ollama' | 'adb' | 'cli';
      prompt?: string;
      model?: string;
      serial?: string;
      deviceContext?: string;
    };

    const mode = body.mode || 'claude';
    const prompt = (body.prompt || '').trim();
    if (!prompt) return NextResponse.json({ success: false, error: 'Prompt vacío.' }, { status: 400 });

    const fullPrompt = body.deviceContext
      ? `[Dispositivo Android conectado: ${body.deviceContext}]\n\n${prompt}`
      : prompt;

    // 1. Inferencia real con Claude Code / DeepSeek CLI nativo
    if (mode === 'claude') {
      const bin = fs.existsSync(CLAUDE_EXE) ? CLAUDE_EXE : 'claude';
      const { stdout } = await execFileAsync(bin, ['-p', fullPrompt], {
        timeout: 45000,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      });
      const output = stdout.trim() || 'Respuesta completada.';
      const suggestions = generateContextSuggestions(prompt, output);
      return NextResponse.json({ success: true, output, suggestions, meta: { provider: 'claude-deepseek' } });
    }

    // 2. Inferencia con Ollama / Llama local (fallback a Claude)
    if (mode === 'ollama') {
      try {
        const model = (body.model || 'llama3.2').trim();
        const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: fullPrompt, stream: false }),
        });
        if (res.ok) {
          const data = (await res.json()) as { response?: string };
          const output = (data.response || '').trim();
          const suggestions = generateContextSuggestions(prompt, output);
          return NextResponse.json({ success: true, output, suggestions, meta: { provider: 'ollama', model } });
        }
      } catch {}
      // Fallback a Claude / DeepSeek
      const bin = fs.existsSync(CLAUDE_EXE) ? CLAUDE_EXE : 'claude';
      const { stdout } = await execFileAsync(bin, ['-p', fullPrompt], { timeout: 35000, windowsHide: true });
      const output = stdout.trim();
      const suggestions = generateContextSuggestions(prompt, output);
      return NextResponse.json({ success: true, output, suggestions, meta: { provider: 'claude-fallback' } });
    }

    // 3. Ejecución directa en ADB Shell
    if (mode === 'adb') {
      if (SHELL_META_RE.test(prompt)) {
        return NextResponse.json({ success: false, error: 'Metacaracteres de shell no permitidos.' }, { status: 400 });
      }
      const serialArgs = body.serial && isValidDeviceSerial(body.serial) ? ['-s', body.serial] : [];
      const tokens = prompt.split(/\s+/).filter(Boolean);
      const args = tokens[0] === 'adb' ? [...serialArgs, ...tokens.slice(1)] : [...serialArgs, 'shell', ...tokens];
      const { stdout, stderr } = await execFileAsync(ADB, args, { timeout: 12000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
      const output = (stdout || stderr || '(sin salida)').trim();
      const suggestions = generateContextSuggestions(prompt, output);
      return NextResponse.json({ success: true, output, suggestions, meta: { provider: 'adb' } });
    }

    // 4. Modo CLI para herramientas del sistema
    if (SHELL_META_RE.test(prompt)) return NextResponse.json({ success: false, error: 'Metacaracteres bloqueados.' }, { status: 400 });
    const parts = prompt.split(/\s+/).filter(Boolean);
    const cmd = parts[0]?.toLowerCase() || '';

    let bin = cmd;
    let args = parts.slice(1);
    if (cmd === 'claude') bin = fs.existsSync(CLAUDE_EXE) ? CLAUDE_EXE : 'claude';
    else if (cmd === 'gemini' && fs.existsSync(GEMINI_JS)) { bin = 'node'; args = [GEMINI_JS, ...args]; }
    else if (cmd === 'adb') bin = ADB;
    else if (cmd === 'ollama') bin = fs.existsSync(OLLAMA_EXE) ? OLLAMA_EXE : 'ollama';
    else if (cmd !== 'python') return NextResponse.json({ success: false, error: `CLI no soportado: ${cmd}` }, { status: 400 });

    const { stdout, stderr } = await execFileAsync(bin, args, { timeout: 30000, windowsHide: true });
    const output = (stdout || stderr || '(completado)').trim();
    const suggestions = generateContextSuggestions(prompt, output);
    return NextResponse.json({ success: true, output, suggestions, meta: { provider: cmd } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
