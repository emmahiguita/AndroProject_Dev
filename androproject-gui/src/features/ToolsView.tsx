'use client';

import { useState, useRef, useEffect } from 'react';
import { RefreshCw, PowerOff, Settings, Wrench, Terminal, ChevronRight, Loader2, Cpu, HardDrive, Thermometer, Clock } from 'lucide-react';
import { QuickAction } from '@/components/ui/dashboard-components';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { useActions } from '@/hooks/useActions';
import { ViewShell } from '@/components/ViewShell';
import { DeviceInfo } from './types';

interface ToolsViewProps {
  device?: DeviceInfo | null;
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

interface ShellLine {
  type: 'cmd' | 'out' | 'err';
  text: string;
}

export function ToolsView({ device }: ToolsViewProps = {}) {
  const { t, dark } = useTheme();
  const { run } = useActions();
  const activeSerial = useAppStore((s) => s.activeSerial);
  const storeDevice = useAppStore((s) => s.device);
  const dev = device || storeDevice;

  // ── ADB Shell ──
  const [shellLines, setShellLines] = useState<ShellLine[]>([
    { type: 'out', text: 'Shell ADB de AndroProject — Ingresa un comando (ej: pm list packages, getprop)...' },
  ]);
  const [shellInput, setShellInput] = useState('');
  const [shellBusy, setShellBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const shellEndRef = useRef<HTMLDivElement>(null);

  // ── Diagnostics ──
  const [diagData, setDiagData] = useState<Record<string, string> | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  useEffect(() => {
    shellEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [shellLines]);

  const runShellCmd = async (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;
    setHistory(h => [cmd, ...h.slice(0, 49)]);
    setHistIdx(-1);
    setShellLines(l => [...l, { type: 'cmd', text: `$ ${cmd}` }]);
    setShellInput('');
    setShellBusy(true);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'adb_shell', serial: activeSerial, cmd }),
      });
      const data = await res.json();
      if (data.output !== undefined && data.output !== '') {
        setShellLines(l => [...l, { type: 'out', text: data.output }]);
      } else if (!data.success) {
        setShellLines(l => [...l, { type: 'err', text: data.error || 'Error desconocido' }]);
      } else {
        setShellLines(l => [...l, { type: 'out', text: '(sin salida)' }]);
      }
    } catch (e) {
      setShellLines(l => [...l, { type: 'err', text: String(e) }]);
    } finally {
      setShellBusy(false);
    }
  };

  const handleShellKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { runShellCmd(shellInput); return; }
    if (e.key === 'ArrowUp') {
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      setShellInput(history[next] || '');
      e.preventDefault();
    }
    if (e.key === 'ArrowDown') {
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setShellInput(next === -1 ? '' : history[next]);
      e.preventDefault();
    }
  };

  const loadDiagnostics = async () => {
    if (!dev) return;
    setDiagLoading(true);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_diagnostics', serial: activeSerial }),
      });
      const data = await res.json();
      if (data.diagnostics) {
        const d = data.diagnostics;
        setDiagData({
          'Arquitectura CPU': d.arch || '--',
          'SDK Android': d.sdk || '--',
          'Kernel': d.kernel || '--',
          'Tiempo activo': d.uptime || '--',
          'RAM Total': (d.ram as Record<string,string>)?.memtotal || '--',
          'RAM Libre': (d.ram as Record<string,string>)?.memavailable || '--',
          'Almacenamiento Total': (d.storage as Record<string,string>)?.size || '--',
          'Almacenamiento Libre': (d.storage as Record<string,string>)?.free || '--',
          'Resolución': d.display_resolution || '--',
          'DPI': d.display_dpi || '--',
        });
      }
    } catch {}
    setDiagLoading(false);
  };

  return (
    <ViewShell navId="tools">
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-3 pb-12">
        {/* ── Page Header ── */}
        <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl px-4 py-3`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${dark ? 'bg-[#1bae6e]/15 text-[#22c97d]' : 'bg-emerald-100 text-emerald-600'}`}>
              <Terminal size={16} />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${t.text}`}>Terminal & Herramientas ADB</h2>
              <p className={`text-xs ${t.textMuted}`}>Comandos directos a la consola Android, diagnósticos de hardware y reinicios.</p>
            </div>
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-3.5`}>
          <div className="flex items-center gap-2 mb-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dark ? 'bg-slate-500/10 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Wrench size={14} />
            </div>
            <div>
              <h2 className={`text-xs font-bold ${t.text}`}>Herramientas del Dispositivo</h2>
              <p className={`text-[10px] ${t.textMuted}`}>Reinicia o accede a modos especiales de recuperación.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <QuickAction dark={dark} icon={<RefreshCw size={14} />} title="Reinicio Normal" sub="Al sistema principal" color="blue" onClick={() => run('reboot', 'Reiniciando')} />
            <QuickAction dark={dark} icon={<PowerOff size={14} />} title="Apagado" sub="Forma segura" color="red" onClick={() => run('power_off', 'Apagando')} />
            <QuickAction dark={dark} icon={<Settings size={14} />} title="Arranque" sub="Fastboot" color="amber" onClick={() => run('reboot_bootloader', 'Reiniciando a modo Arranque')} />
            <QuickAction dark={dark} icon={<Settings size={14} />} title="Recuperación" sub="Rescate" color="violet" onClick={() => run('reboot_recovery', 'Reiniciando a modo Recuperación')} />
          </div>
          <p className={`text-[9px] ${t.textSub} uppercase tracking-widest font-bold mb-1.5 px-0.5`}>Fastboot</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <QuickAction dark={dark} icon={<RefreshCw size={14} />} title="Reiniciar Fastboot" sub="Volver a Android" color="teal" onClick={() => run('fastboot_reboot', 'Reiniciando desde Fastboot')} />
            <QuickAction dark={dark} icon={<Settings size={14} />} title="Recovery" sub="Salto directo" color="violet" onClick={() => run('fastboot_reboot_recovery', 'Entrando a Recovery')} />
            <QuickAction dark={dark} icon={<PowerOff size={14} />} title="Restablecer" sub="¡Borra todo!" color="red" onClick={() => { if (confirm('¿FORMATEAR el teléfono vía Fastboot?')) run('fastboot_erase', 'Formateando...'); }} />
          </div>
        </div>

        {/* ── System Diagnostics ── */}
        <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-3.5`}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                <Cpu size={14} />
              </div>
              <div>
                <h2 className={`text-xs font-bold ${t.text}`}>Diagnóstico de Hardware</h2>
                <p className={`text-[10px] ${t.textMuted}`}>Lectura en tiempo real de CPU, RAM y kernel.</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={diagLoading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              onClick={loadDiagnostics}
              disabled={diagLoading || !dev}
              aria-label="Analizar diagnóstico"
            >
              {diagLoading ? 'Analizando...' : 'Analizar'}
            </Button>
          </div>

          {!diagData && !diagLoading && (
            <div className={`flex flex-col items-center justify-center py-5 ${t.textSub} text-center`}>
              <HardDrive size={24} className="mb-2 opacity-30" />
              <p className="text-[11px] font-medium">Presiona «Analizar» para leer el estado real del hardware</p>
            </div>
          )}

          {diagData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-1">
              {Object.entries(diagData).map(([k, v]) => (
                <div key={k} className={`flex items-center justify-between py-1.5 border-b ${dark ? 'border-white/5' : 'border-slate-100'} last:border-0`}>
                  <span className={`text-[11px] ${t.textMuted} flex items-center gap-1.5`}>
                    {k.includes('RAM') ? <Thermometer size={11} /> : k.includes('Tiempo') ? <Clock size={11} /> : <HardDrive size={11} />}
                    {k}
                  </span>
                  <span className={`text-[11px] font-mono font-semibold ${dark ? 'text-white/80' : 'text-slate-700'} ${dark ? 'bg-white/[0.04]' : 'bg-slate-50'} px-2 py-0.5 rounded`}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── ADB Shell ── */}
        <div className={`rounded-xl border overflow-hidden shadow-md ${dark ? 'bg-[#080b14] border-white/10' : 'bg-white border-slate-200'}`}>
          <div className={`flex items-center justify-between px-3.5 py-2.5 border-b ${dark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dark ? 'bg-[#22c97d]/10 text-[#22c97d]' : 'bg-emerald-100 text-emerald-700'}`}>
                <Terminal size={14} />
              </div>
              <div>
                <h2 className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>Shell ADB Interactivo</h2>
                <p className={`text-[10px] ${dark ? 'text-white/40' : 'text-slate-500'}`}>Comandos directos a Android. Usa ↑ ↓ para navegar en el historial.</p>
              </div>
            </div>
            <button
              onClick={() => setShellLines([{ type: 'out', text: 'Terminal limpiada.' }])}
              className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-colors ${
                dark ? 'text-white/40 hover:text-white hover:bg-white/[0.08]' : 'text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              Limpiar
            </button>
          </div>

          <div className={`min-h-[220px] max-h-[360px] h-72 overflow-y-auto p-3.5 font-mono text-[11px] space-y-1 custom-scrollbar ${
            dark ? 'bg-[#04060c] text-slate-200' : 'bg-slate-950 text-slate-100'
          }`}>
            {shellLines.map((line, i) => (
              <div key={i} className={
                line.type === 'cmd'
                  ? 'text-[#22c97d] font-bold'
                  : line.type === 'err'
                    ? 'text-rose-400 font-semibold'
                    : 'text-slate-300'
              }>
                {line.text.split('\n').map((l, j) => <div key={j} className="leading-relaxed">{l || ' '}</div>)}
              </div>
            ))}
            <div ref={shellEndRef} />
          </div>

          <div className={`flex items-center gap-2 px-3.5 py-2.5 border-t ${dark ? 'border-white/10 bg-[#0b0e18]' : 'border-slate-200 bg-slate-100'}`}>
            <ChevronRight size={14} className="text-[#22c97d] shrink-0" />
            <input
              type="text"
              value={shellInput}
              onChange={e => setShellInput(e.target.value)}
              onKeyDown={handleShellKey}
              disabled={shellBusy}
              placeholder={dev ? `adb shell ... (ej: pm list packages, getprop, input keyevent 26)` : 'Conecta un dispositivo para ejecutar shell'}
              className={`flex-1 bg-transparent font-mono text-xs focus:outline-none disabled:opacity-40 ${
                dark ? 'text-white placeholder:text-white/30' : 'text-slate-900 placeholder:text-slate-400'
              }`}
              autoComplete="off"
              spellCheck={false}
            />
            {shellBusy && <Loader2 size={13} className="animate-spin text-[#22c97d] shrink-0" />}
            <button
              onClick={() => runShellCmd(shellInput)}
              disabled={!shellInput.trim() || shellBusy}
              className="px-3.5 py-1.5 rounded-md bg-[#1bae6e] hover:bg-[#22c97d] text-white text-[11px] font-bold transition-all shadow-sm disabled:opacity-30 shrink-0"
            >
              Ejecutar
            </button>
          </div>
        </div>
      </div>
    </ViewShell>
  );
}
