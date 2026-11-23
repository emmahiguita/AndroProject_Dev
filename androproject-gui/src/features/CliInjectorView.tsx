// Consola CLI: coordina motores, entrada de comandos y respuestas interactivas.
'use client';
import { apiUrl } from '@/lib/api-url';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useAppStore } from '@/stores';
import { ViewShell } from '@/components/ViewShell';
import { Button } from '@/components/ui/Button';
import { CliEngineSelector, type InjectorMode, type DiscoveryState } from './cli/CliEngineSelector';
import { CliResponseViewer } from './cli/CliResponseViewer';
import { PRESETS, engineAvailable } from './cli/cli-suggestions';
import type { DeviceInfo } from './types';

export function CliInjectorView({ device: propDevice }: { device?: DeviceInfo | null }) {
  const { dark } = useTheme();
  const storeDevice = useAppStore((s) => s.device);
  const activeSerial = useAppStore((s) => s.activeSerial);
  const device = propDevice || storeDevice;
  const targetSerial = activeSerial || device?.serial;
  const abortRef = useRef<AbortController | null>(null);
  const [mode, setMode] = useState<InjectorMode>('adb');
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
      const res = await fetch(apiUrl('/api/ai-cli'));
      const data = await res.json();
      if (data.success) {
        setDiscovery({ ollamaOnline: Boolean(data.ollama?.online), models: data.ollama?.models || [], clis: data.clis || {} });
      }
    } catch {
      // Un fallo de detección invalida el último estado recibido.
      setDiscovery({ ollamaOnline: false, models: [], clis: {} });
    }
  }, []);

  useEffect(() => {
    refreshDiscovery();
    return () => { abortRef.current?.abort(); abortRef.current = null; };
  }, [refreshDiscovery]);

  // ADB necesita una conexión seleccionada y un ejecutable detectado por el backend.
  const canExecute = engineAvailable(mode, discovery) && (mode !== 'adb' || Boolean(targetSerial && device?.connected));

  // Envía la consulta al motor elegido y descarta la salida anterior al fallar.
  const executePrompt = async (textToSend: string) => {
    const text = textToSend.trim();
    // La referencia bloquea dobles envíos incluso antes del siguiente render de React.
    if (!text || abortRef.current || !canExecute) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setError(null);
    setOutput('');
    setSuggestions([]);
    setProviderMeta('');
    try {
      const deviceContext = mode !== 'adb' && includeDevice && device?.connected
        ? `Modelo: ${device.model || 'Android'}, Serial: ${device.serial}, Android: ${device.androidVersion || '--'}, Batería: ${device.battery ?? '--'}%`
        : undefined;

      const res = await fetch(apiUrl('/api/ai-cli'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, prompt: text, model, serial: targetSerial, deviceContext }),
        signal: ctrl.signal,
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
      setError(ctrl.signal.aborted ? 'Se canceló la espera de la respuesta.' : err instanceof Error ? err.message : String(err));
    } finally {
      if (abortRef.current === ctrl) { abortRef.current = null; setRunning(false); }
    }
  };

  const cardCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  return (
    <ViewShell navId="cli">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <CliEngineSelector
          mode={mode} onSelectMode={setMode} model={model} onSelectModel={setModel}
          includeDevice={includeDevice} onToggleIncludeDevice={setIncludeDevice}
          discovery={discovery} onRefreshDiscovery={refreshDiscovery} dark={dark}
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
            aria-label="Consulta o comando"
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
                ? 'Escribe tu solicitud para Claude... [Ctrl+Enter]'
                : mode === 'ollama'
                ? 'Prompt para Ollama / Llama local... [Ctrl+Enter]'
                : mode === 'adb'
                ? 'Selecciona una consulta ADB de los botones superiores...'
                : 'Comando CLI (claude, adb, python, gemini)...'
            }
            className={`w-full rounded-lg border p-3 text-sm font-mono outline-none resize-y transition-colors ${
              dark
                ? 'bg-zinc-900/60 border-zinc-700 text-zinc-100 placeholder:text-zinc-400 focus:border-zinc-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-600 focus:border-slate-600'
            }`}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-[11px] ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>Presiona Ctrl + Enter para ejecutar</span>
            <div className="flex items-center gap-2">
              {running && (
                <Button variant="secondary" size="md" onClick={() => abortRef.current?.abort()}>
                  Cancelar espera
                </Button>
              )}
              <Button variant="primary" size="md" icon={<Play size={13} />} disabled={running || !canExecute || !prompt.trim()} onClick={() => executePrompt(prompt)}>
                {running ? 'Ejecutando...' : 'Inyectar / Ejecutar'}
              </Button>
            </div>
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
