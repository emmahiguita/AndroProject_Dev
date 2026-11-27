// ============================================================================
// ARCHIVO: CliInjectorView.tsx
// QUÉ HACE: Consola CLI e IA conectada a Rust (`/api/ai-cli`) para ejecutar
//           consultas en Claude CLI, Ollama / LM Studio local y ADB Shell.
// CÓMO FUNCIONA: Descubre motores disponibles al montar, auto-selecciona un
//           motor activo si el actual no está disponible, valida entradas sin
//           fallos silenciosos y permite cancelar peticiones en curso.
// POR QUÉ: Evitar que pulsar Ejecutar o Ctrl+Enter no haga nada cuando un
//          motor está offline o falta dispositivo (< 200 líneas, SRP).
// ============================================================================
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play } from 'lucide-react';
import { apiUrl } from '@/lib/api-url';
import { useTheme } from '@/hooks/useTheme';
import { useAppStore } from '@/stores';
import { ViewShell } from '@/components/ViewShell';
import { Button } from '@/components/ui/Button';
import { CliEngineSelector, type InjectorMode, type DiscoveryState } from './cli/CliEngineSelector';
import { CliResponseViewer } from './cli/CliResponseViewer';
import { UiAutomationPanel } from './cli/UiAutomationPanel';
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
  const [skillId, setSkillId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [includeDevice, setIncludeDevice] = useState(true);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [providerMeta, setProviderMeta] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryState>({ ollamaOnline: false, models: [], clis: {}, queries: [], skills: [] });

  const refreshDiscovery = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/ai-cli'));
      const data = await res.json();
      if (!data.success) return;
      const models: string[] = data.ollama?.models || [];
      const nextDisc: DiscoveryState = {
        ollamaOnline: Boolean(data.ollama?.online), models, clis: data.clis || {},
        queries: data.queries || [], skills: data.skills || [],
      };
      setDiscovery(nextDisc);
      if (models.length > 0) {
        const fastModel = models.find((m) => /:3b|:7b|:8b|:9b/i.test(m)) || models[0];
        setModel((prev) => (models.includes(prev) ? prev : fastModel));
      }
      setMode((prev) => {
        if (engineAvailable(prev, nextDisc) && (prev !== 'adb' || Boolean(targetSerial))) return prev;
        return nextDisc.ollamaOnline ? 'ollama' : nextDisc.clis.claude ? 'claude' : prev;
      });
    } catch { setDiscovery({ ollamaOnline: false, models: [], clis: {}, queries: [], skills: [] }); }
  }, [targetSerial]);

  useEffect(() => { refreshDiscovery(); return () => { abortRef.current?.abort(); abortRef.current = null; }; }, [refreshDiscovery]);

  const canExecute = engineAvailable(mode, discovery) && (mode !== 'adb' || Boolean(targetSerial && device?.connected));
  const presets = mode === 'adb' && discovery.queries.length ? discovery.queries.map((value) => ({ label: value, value })) : PRESETS[mode];

  /** Envía la consulta al motor elegido; nunca falla en silencio si falta motor o dispositivo. */
  const executePrompt = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || abortRef.current) return;

    let effectiveMode: InjectorMode = mode;
    if (effectiveMode === 'adb' && discovery.queries.length > 0 && !discovery.queries.includes(text)) {
      if (discovery.ollamaOnline) { effectiveMode = 'ollama'; setMode('ollama'); }
      else if (discovery.clis.claude) { effectiveMode = 'claude'; setMode('claude'); }
      else { setError('Consulta de IA detectada en modo ADB. Inicia Ollama (:11434) o Claude CLI para responderla.'); return; }
    }
    if (effectiveMode === 'adb' && (!targetSerial || !device?.connected)) {
      setError('Conecta un dispositivo Android por USB o Wi-Fi para ejecutar consultas ADB.');
      return;
    }
    if (!engineAvailable(effectiveMode, discovery)) {
      setError(effectiveMode === 'ollama'
        ? 'Ollama / LM Studio está offline en 127.0.0.1:11434/1234. Inicia el servicio o cambia a Claude.'
        : `El motor "${effectiveMode}" no está disponible. Pulsa "Detectar motores".`);
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true); setError(null); setOutput(''); setSuggestions([]); setProviderMeta('');
    try {
      const deviceContext = effectiveMode !== 'adb' && includeDevice && device?.connected
        ? `Modelo: ${device.model || 'Android'}, Serial: ${device.serial}, Android: ${device.androidVersion || '--'}, RAM: ${device.ram || '--'}, Batería: ${device.battery ?? '--'}%`
        : undefined;
      const res = await fetch(apiUrl('/api/ai-cli'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: effectiveMode, prompt: text, model, skillId: skillId || undefined, serial: targetSerial, deviceContext }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (data.success) { setOutput(data.output || '(sin salida)'); setSuggestions(data.suggestions || []); setProviderMeta(data.meta?.provider || effectiveMode); }
      else setError(data.error || 'Error ejecutando solicitud.');
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
          skillId={skillId} onSelectSkillId={setSkillId}
          includeDevice={includeDevice} onToggleIncludeDevice={setIncludeDevice}
          discovery={discovery} onRefreshDiscovery={refreshDiscovery} dark={dark}
        />

        <div className={`rounded-xl border p-4 sm:p-5 space-y-3 ${cardCls} shadow-sm`}>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label} type="button" onClick={() => setPrompt(p.value)}
                className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                  dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 active:scale-95' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <textarea
            rows={4} aria-label="Consulta o comando" value={prompt} onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void executePrompt(prompt); } }}
            placeholder={mode === 'claude' ? 'Escribe tu solicitud para Claude... [Ctrl+Enter]' : mode === 'ollama' ? 'Prompt para Ollama / Llama local... [Ctrl+Enter]' : mode === 'adb' ? 'Selecciona una consulta ADB de los botones superiores...' : 'Comando CLI...'}
            className={`w-full rounded-lg border p-3 text-sm font-mono outline-none resize-y transition-colors ${
              dark ? 'bg-zinc-900/60 border-zinc-700 text-zinc-100 placeholder:text-zinc-400 focus:border-zinc-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-600 focus:border-slate-600'
            }`}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-[11px] ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Presiona Ctrl + Enter para ejecutar {!canExecute && '· Selecciona un motor activo arriba'}
            </span>
            <div className="flex items-center gap-2">
              {running && (<Button variant="secondary" size="md" onClick={() => abortRef.current?.abort()}>Cancelar espera</Button>)}
              <Button variant="primary" size="md" icon={<Play size={13} />} disabled={running || !prompt.trim()} onClick={() => void executePrompt(prompt)}>
                {running ? 'Ejecutando...' : 'Inyectar / Ejecutar'}
              </Button>
            </div>
          </div>
        </div>

        <CliResponseViewer
          output={output} error={error} providerMeta={providerMeta} suggestions={suggestions}
          onSelectSuggestion={(sug) => { setPrompt(sug); void executePrompt(sug); }} dark={dark}
        />
        <UiAutomationPanel serial={targetSerial} connected={device?.connected} model={model} ollamaOnline={discovery.ollamaOnline} dark={dark} />
      </div>
    </ViewShell>
  );
}
