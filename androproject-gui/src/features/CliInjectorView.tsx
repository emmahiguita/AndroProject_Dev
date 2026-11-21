// ============================================================================
// ARCHIVO: CliInjectorView.tsx
// QUÉ HACE: Consola profesional de inyección CLI / IA (Ollama/Llama local,
//           ADB Shell y CLIs locales como Claude, Gemini, Python, Antigravity).
// CÓMO FUNCIONA: Consulta `GET /api/ai-cli` para detectar modelos/CLIs reales
//           y envía prompts/comandos vía `POST /api/ai-cli` inyectando el
//           contexto real del dispositivo conectado.
// POR QUÉ: Permitir automatización e inferencia real con diseño 100% limpio,
//           monocromo y legible tanto en modo claro como oscuro (< 200 líneas).
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Terminal, Cpu, Play, RefreshCw, Copy, Check, Smartphone } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { Button } from '@/components/ui/Button';
import type { DeviceInfo } from './types';

type InjectorMode = 'ollama' | 'adb' | 'cli';

interface DiscoveryState {
  ollamaOnline: boolean;
  models: string[];
  clis: Record<string, boolean>;
}

const PRESETS: Record<InjectorMode, { label: string; value: string }[]> = {
  ollama: [
    { label: 'Diagnosticar dispositivo', value: 'Analiza el estado del dispositivo conectado y sugiere 3 optimizaciones seguras.' },
    { label: 'Auditar batería', value: '¿Qué comandos ADB debo revisar para detectar drenaje de batería?' },
  ],
  adb: [
    { label: 'Propiedades modelo', value: 'getprop ro.product.model' },
    { label: 'Batería', value: 'dumpsys battery' },
    { label: 'Memoria RAM', value: 'cat /proc/meminfo' },
  ],
  cli: [
    { label: 'Modelos Ollama', value: 'ollama list' },
    { label: 'Dispositivos ADB', value: 'adb devices -l' },
    { label: 'Versión Claude CLI', value: 'claude --version' },
    { label: 'Versión Gemini CLI', value: 'gemini --version' },
  ],
};

export function CliInjectorView({ device }: { device?: DeviceInfo | null }) {
  const { dark } = useTheme();
  const [mode, setMode] = useState<InjectorMode>('ollama');
  const [model, setModel] = useState('llama3.2');
  const [prompt, setPrompt] = useState('');
  const [includeDevice, setIncludeDevice] = useState(true);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryState>({ ollamaOnline: false, models: [], clis: {} });

  const refreshProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-cli');
      const data = await res.json();
      if (data.success) {
        const models: string[] = data.ollama?.models || [];
        setDiscovery({ ollamaOnline: Boolean(data.ollama?.online), models, clis: data.clis || {} });
        if (models.length > 0) setModel((prev) => (models.includes(prev) ? prev : models[0]));
      }
    } catch {
      // Silencioso en descubrimiento inicial
    }
  }, []);

  useEffect(() => { refreshProviders(); }, [refreshProviders]);

  const handleRun = async () => {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      const deviceContext = includeDevice && device?.connected
        ? `Modelo: ${device.model || 'Android'}, Serial: ${device.serial}, Android: ${device.androidVersion || '--'}, Batería: ${device.battery ?? '--'}%`
        : undefined;

      const res = await fetch('/api/ai-cli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, prompt, model, serial: device?.serial, deviceContext }),
      });
      const data = await res.json();
      if (data.success) setOutput(data.output || '(sin salida)');
      else setError(data.error || 'Error ejecutando la solicitud.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const cardCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';
  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';
  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
      active
        ? dark ? 'bg-zinc-100 text-zinc-950 border-zinc-100' : 'bg-slate-900 text-white border-slate-900'
        : dark ? 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
    }`;

  return (
    <ViewShell navId="cli">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        {/* Cabecera y estado de motores */}
        <div className={`rounded-xl border p-5 ${cardCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                <Terminal size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Inyección CLI &amp; IA Local</h2>
                <p className={`text-xs ${mutedCls}`}>Ejecuta prompts reales con Ollama/Llama, ADB Shell o CLIs locales (Claude, Gemini, Python).</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={12} />} onClick={refreshProviders}>
              Detectar motores
            </Button>
          </div>

          {/* Selector de modo + estado real */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setMode('ollama')} className={tabCls(mode === 'ollama')}>Ollama / Llama</button>
              <button type="button" onClick={() => setMode('adb')} className={tabCls(mode === 'adb')}>ADB Shell</button>
              <button type="button" onClick={() => setMode('cli')} className={tabCls(mode === 'cli')}>CLI / Antigravity</button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`px-2 py-0.5 rounded border font-medium ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                Ollama: {discovery.ollamaOnline ? `${discovery.models.length} modelos` : 'offline'}
              </span>
              {Object.entries(discovery.clis).filter(([, ok]) => ok).map(([name]) => (
                <span key={name} className={`px-2 py-0.5 rounded border font-mono ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Área de entrada */}
        <div className={`rounded-xl border p-5 space-y-3 ${cardCls}`}>
          {mode === 'ollama' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Cpu size={14} className={mutedCls} />
                <span className={`text-xs font-medium ${mutedCls}`}>Modelo:</span>
                {discovery.models.length > 0 ? (
                  <select value={model} onChange={(e) => setModel(e.target.value)} className={`px-2.5 py-1 text-xs rounded-lg border outline-none ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-300 text-slate-900'}`}>
                    {discovery.models.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input value={model} onChange={(e) => setModel(e.target.value)} className={`px-2.5 py-1 text-xs rounded-lg border outline-none font-mono ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-300 text-slate-900'}`} />
                )}
              </div>
              <label className={`flex items-center gap-2 text-xs cursor-pointer ${mutedCls}`}>
                <input type="checkbox" checked={includeDevice} onChange={(e) => setIncludeDevice(e.target.checked)} />
                <Smartphone size={13} /> Inyectar contexto del dispositivo
              </label>
            </div>
          )}

          {/* Presets rápidos */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS[mode].map((p) => (
              <button key={p.label} type="button" onClick={() => setPrompt(p.value)} className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
                {p.label}
              </button>
            ))}
          </div>

          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={mode === 'ollama' ? 'Escribe tu prompt para Llama / Ollama...' : mode === 'adb' ? 'Ej: getprop ro.product.model' : 'Ej: ollama list | claude --version | gemini --version'}
            className={`w-full rounded-lg border p-3 text-xs font-mono outline-none resize-y ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-slate-500'}`}
          />

          <div className="flex justify-end">
            <Button variant="primary" size="md" icon={<Play size={13} />} disabled={running || !prompt.trim()} onClick={handleRun}>
              {running ? 'Ejecutando...' : 'Inyectar / Ejecutar'}
            </Button>
          </div>
        </div>

        {/* Salida real */}
        {(output || error) && (
          <div className={`rounded-xl border p-4 ${cardCls}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${mutedCls}`}>Salida</span>
              {output && (
                <button type="button" onClick={handleCopy} className={`inline-flex items-center gap-1 text-xs ${mutedCls} hover:underline`}>
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copiado' : 'Copiar'}
                </button>
              )}
            </div>
            {error ? (
              <p className={`text-xs font-mono ${dark ? 'text-red-400' : 'text-red-700'}`}>{error}</p>
            ) : (
              <pre className={`text-xs font-mono whitespace-pre-wrap break-words max-h-96 overflow-y-auto ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>{output}</pre>
            )}
          </div>
        )}
      </div>
    </ViewShell>
  );
}
