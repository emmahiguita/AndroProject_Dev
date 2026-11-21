// ============================================================================
// ARCHIVO: CliInjectorView.tsx
// QUÉ HACE: Consola profesional de inyección CLI / IA: DeepSeek (Claude CLI),
//           Ollama local, ADB Shell nativo y comandos de sistema.
// CÓMO FUNCIONA: Orquesta la entrada de texto, selección de motor, presets rápidos
//           y respuestas interactivas dinámicas con opciones de respuesta.
// POR QUÉ: Permite entender cualquier texto (desde 'hola' hasta párrafos grandes)
//           con ejecución real y diseño monocromo de alta legibilidad (< 200L).
// ============================================================================
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Play } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { Button } from '@/components/ui/Button';
import { CliEngineSelector, type InjectorMode, type DiscoveryState } from './cli/CliEngineSelector';
import { CliResponseViewer } from './cli/CliResponseViewer';
import type { DeviceInfo } from './types';

const PRESETS: Record<InjectorMode, { label: string; value: string }[]> = {
  claude: [
    { label: 'Diagnosticar estado', value: 'Analiza el estado general del teléfono conectado y sugiere 3 optimizaciones.' },
    { label: 'Auditar batería', value: '¿Qué comandos ADB debo ejecutar para revisar el consumo y temperatura de batería?' },
    { label: 'Seguridad y Permisos', value: '¿Cómo verificar si hay aplicaciones con permisos excesivos en segundo plano?' },
  ],
  ollama: [
    { label: 'Análisis de rendimiento', value: 'Analiza el hardware del dispositivo y recomienda balance de memoria.' },
    { label: 'Comandos clave', value: 'Lista 5 comandos ADB esenciales para depuración en producción.' },
  ],
  adb: [
    { label: 'Modelo', value: 'getprop ro.product.model' },
    { label: 'Batería', value: 'dumpsys battery' },
    { label: 'RAM', value: 'cat /proc/meminfo' },
    { label: 'Apps usuario', value: 'pm list packages -3' },
  ],
  cli: [
    { label: 'Claude Version', value: 'claude --version' },
    { label: 'ADB Devices', value: 'adb devices -l' },
    { label: 'Ollama List', value: 'ollama list' },
  ],
};

export function CliInjectorView({ device }: { device?: DeviceInfo | null }) {
  const { dark } = useTheme();
  const [mode, setMode] = useState<InjectorMode>('claude');
  const [model, setModel] = useState('llama3.2');
  const [prompt, setPrompt] = useState('');
  const [includeDevice, setIncludeDevice] = useState(true);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [providerMeta, setProviderMeta] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryState>({ ollamaOnline: false, models: [], clis: {} });

  const refreshDiscovery = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-cli');
      const data = await res.json();
      if (data.success) {
        setDiscovery({ ollamaOnline: Boolean(data.ollama?.online), models: data.ollama?.models || [], clis: data.clis || {} });
      }
    } catch {}
  }, []);

  useEffect(() => { refreshDiscovery(); }, [refreshDiscovery]);

  const executePrompt = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || running) return;
    setRunning(true);
    setError(null);
    try {
      const deviceContext = includeDevice && device?.connected
        ? `Modelo: ${device.model || 'Android'}, Serial: ${device.serial}, Android: ${device.androidVersion || '--'}, Batería: ${device.battery ?? '--'}%`
        : undefined;

      const res = await fetch('/api/ai-cli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, prompt: text, model, serial: device?.serial, deviceContext }),
      });
      const data = await res.json();
      if (data.success) {
        setOutput(data.output || '(sin salida)');
        setSuggestions(data.suggestions || []);
        setProviderMeta(data.meta?.provider || mode);
      } else {
        setError(data.error || 'Error ejecutando solicitud.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const cardCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  return (
    <ViewShell navId="cli">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <CliEngineSelector
          mode={mode}
          onSelectMode={setMode}
          model={model}
          onSelectModel={setModel}
          includeDevice={includeDevice}
          onToggleIncludeDevice={setIncludeDevice}
          discovery={discovery}
          onRefreshDiscovery={refreshDiscovery}
          dark={dark}
        />

        {/* Formulario de entrada y presets */}
        <div className={`rounded-xl border p-4 sm:p-5 space-y-3 ${cardCls} shadow-sm`}>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS[mode].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPrompt(p.value)}
                className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                  dark
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 active:scale-95'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                executePrompt(prompt);
              }
            }}
            placeholder={
              mode === 'claude'
                ? 'Escribe tu solicitud para DeepSeek / Claude Code (desde un saludo hasta párrafos largos)... [Ctrl+Enter]'
                : mode === 'ollama'
                ? 'Prompt para Ollama / Llama local... [Ctrl+Enter]'
                : mode === 'adb'
                ? 'Comando ADB Shell (ej: getprop ro.product.model)...'
                : 'Comando CLI (claude, adb, python, gemini)...'
            }
            className={`w-full rounded-lg border p-3 text-xs font-mono outline-none resize-y transition-colors ${
              dark
                ? 'bg-zinc-900/60 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600'
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-slate-500'
            }`}
          />

          <div className="flex items-center justify-between">
            <span className={`text-[11px] ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Presiona Ctrl + Enter para ejecutar</span>
            <Button
              variant="primary"
              size="md"
              icon={<Play size={13} />}
              disabled={running || !prompt.trim()}
              onClick={() => executePrompt(prompt)}
            >
              {running ? 'Ejecutando...' : 'Inyectar / Ejecutar'}
            </Button>
          </div>
        </div>

        {/* Visualizador de respuesta y sugerencias interactivas */}
        <CliResponseViewer
          output={output}
          error={error}
          providerMeta={providerMeta}
          suggestions={suggestions}
          onSelectSuggestion={(sug) => {
            setPrompt(sug);
            executePrompt(sug);
          }}
          dark={dark}
        />
      </div>
    </ViewShell>
  );
}
