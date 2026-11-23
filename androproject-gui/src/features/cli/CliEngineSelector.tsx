// ============================================================================
// ARCHIVO: CliEngineSelector.tsx
// QUÉ HACE: Selector responsivo de motor de ejecución (Claude/DeepSeek, Ollama,
//           ADB Shell o CLI) con insignias de estado real de cada motor.
// CÓMO FUNCIONA: Permite alternar la fuente de inferencia e inyectar datos del
//           dispositivo conectado (batería, serial, Android) al contexto del prompt.
// POR QUÉ: Desacoplar la selección de motor manteniendo código limpio (< 200L).
// ============================================================================
'use client';

import React from 'react';
import { Terminal, Cpu, Smartphone, RefreshCw } from 'lucide-react';
import { engineAvailable } from './cli-suggestions';
import { Button } from '@/components/ui/Button';

export type InjectorMode = 'claude' | 'ollama' | 'adb' | 'cli';

export interface DiscoveryState {
  ollamaOnline: boolean;
  models: string[];
  clis: Record<string, boolean>;
}

interface CliEngineSelectorProps {
  mode: InjectorMode;
  onSelectMode: (m: InjectorMode) => void;
  model: string;
  onSelectModel: (m: string) => void;
  includeDevice: boolean;
  onToggleIncludeDevice: (inc: boolean) => void;
  discovery: DiscoveryState;
  onRefreshDiscovery: () => void;
  dark: boolean;
}

export const CliEngineSelector: React.FC<CliEngineSelectorProps> = ({
  mode,
  onSelectMode,
  model,
  onSelectModel,
  includeDevice,
  onToggleIncludeDevice,
  discovery,
  onRefreshDiscovery,
  dark,
}) => {
  const cardCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';
  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border disabled:cursor-not-allowed disabled:opacity-70 ${
      active
        ? dark
          ? 'bg-zinc-100 text-zinc-950 border-zinc-100 shadow-sm'
          : 'bg-slate-900 text-white border-slate-900 shadow-sm'
        : dark
        ? 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
    }`;

  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${cardCls} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            <Terminal size={17} />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Motores CLI y ADB</h2>
            <p className={`text-xs ${mutedCls}`}>Consultas ADB disponibles. Los demás motores requieren integración.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={12} />} onClick={onRefreshDiscovery}>
          Detectar motores
        </Button>
      </div>

      {/* Pestañas de modo + insignias de detección */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" disabled={!engineAvailable('claude', discovery)} onClick={() => onSelectMode('claude')} className={tabCls(mode === 'claude')}>
            Claude
          </button>
          <button type="button" disabled={!engineAvailable('ollama', discovery)} onClick={() => onSelectMode('ollama')} className={tabCls(mode === 'ollama')}>
            Ollama / Llama
          </button>
          <button type="button" disabled={!engineAvailable('adb', discovery)} onClick={() => onSelectMode('adb')} className={tabCls(mode === 'adb')}>
            ADB Shell
          </button>
          <button type="button" disabled={!engineAvailable('cli', discovery)} onClick={() => onSelectMode('cli')} className={tabCls(mode === 'cli')}>
            CLI Sistema
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className={`px-2 py-0.5 rounded border font-mono ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            Claude: {discovery.clis.claude ? 'activo' : 'no disponible'}
          </span>
          <span className={`px-2 py-0.5 rounded border font-mono ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            Ollama: {discovery.ollamaOnline ? 'activo' : 'offline'}
          </span>
          <span className={`px-2 py-0.5 rounded border font-mono ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            ADB: {discovery.clis.adb ? 'listo' : 'no detectado'}
          </span>
        </div>
      </div>

      {/* Opciones adicionales: modelo Ollama y contexto de hardware */}
      {mode === 'ollama' && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Cpu size={14} className={mutedCls} />
            <span className={`text-xs font-medium ${mutedCls}`}>Modelo:</span>
            {discovery.models.length > 0 ? (
              <select value={model} onChange={(e) => onSelectModel(e.target.value)} className={`px-2.5 py-1 text-xs rounded-lg border outline-none ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-300 text-slate-900'}`}>
                {discovery.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input value={model} onChange={(e) => onSelectModel(e.target.value)} className={`px-2.5 py-1 text-xs rounded-lg border outline-none font-mono ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-300 text-slate-900'}`} />
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 text-xs">
        <label className={`flex items-center gap-2 cursor-pointer ${mutedCls}`}>
          <input type="checkbox" checked={mode !== 'adb' && includeDevice} disabled={mode === 'adb'} onChange={(e) => onToggleIncludeDevice(e.target.checked)} className="rounded" />
          <Smartphone size={13} />
          <span>{mode === 'adb' ? 'Las consultas ADB no usan contexto adicional' : 'Inyectar contexto y estado del dispositivo al prompt'}</span>
        </label>
      </div>
    </div>
  );
};
