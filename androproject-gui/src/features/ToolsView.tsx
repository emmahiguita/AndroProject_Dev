// ============================================================================
// ARCHIVO: ToolsView.tsx
// QUÉ HACE: Vista de Herramientas ADB, reinicios especiales, diagnóstico de
//           hardware en tiempo real y DriverManager USB Windows (PnPUtil).
// CÓMO FUNCIONA: Consulta `POST /api/actions` (`get_diagnostics`, `reboot*`)
//           con iconografía y tipografía monocroma de alto contraste.
// POR QUÉ: Eliminar iconos coloridos (`bg-blue-500/10 text-blue-400`),
//          `glow-card` y textos pequeños no legibles (< 200 líneas, SRP).
// ============================================================================
'use client';

import { useState } from 'react';
import { RefreshCw, PowerOff, Settings, Wrench, Loader2, Cpu, HardDrive, Thermometer, Clock } from 'lucide-react';
import { QuickAction } from '@/components/ui/dashboard-components';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { useActions } from '@/hooks/useActions';
import { ViewShell } from '@/components/ViewShell';
import { DriverManagerPanel } from './tools/DriverManagerPanel';
import { DeviceInfo } from './types';

interface ToolsViewProps {
  device?: DeviceInfo | null;
}

export function ToolsView({ device }: ToolsViewProps = {}) {
  const { dark } = useTheme();
  const { run } = useActions();
  const activeSerial = useAppStore((s) => s.activeSerial);
  const storeDevice = useAppStore((s) => s.device);
  const dev = device || storeDevice;

  const [diagData, setDiagData] = useState<Record<string, string> | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const targetSerial = activeSerial || dev?.serial;

  const loadDiagnostics = async () => {
    if (!dev) return;
    setDiagLoading(true);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_diagnostics', serial: targetSerial }),
      });
      const data = await res.json();
      if (data.diagnostics) {
        const d = data.diagnostics;
        setDiagData({
          'Arquitectura CPU': d.arch || '--',
          'SDK Android': d.sdk || '--',
          'Kernel': d.kernel || '--',
          'Tiempo activo': d.uptime || '--',
          'RAM Total': (d.ram as Record<string, string>)?.memtotal || '--',
          'RAM Libre': (d.ram as Record<string, string>)?.memavailable || '--',
          'Almacenamiento Total': (d.storage as Record<string, string>)?.size || '--',
          'Almacenamiento Libre': (d.storage as Record<string, string>)?.free || '--',
          'Resolución': d.display_resolution || '--',
          'DPI': d.display_dpi || '--',
        });
      }
    } catch {} finally { setDiagLoading(false); }
  };

  const cardCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900 shadow-sm';
  const iconBoxCls = `w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
    dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'
  }`;
  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';

  return (
    <ViewShell navId="tools">
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-3 pb-12">
        <div className={`rounded-xl border px-4 py-3 ${cardCls}`}>
          <div className="flex items-center gap-2.5">
            <div className={iconBoxCls}><Wrench size={16} /></div>
            <div>
              <h2 className="text-sm font-bold">Herramientas ADB &amp; Diagnóstico</h2>
              <p className={`text-xs ${mutedCls}`}>Diagnósticos de hardware, controles de energía y reinicios a modos especiales.</p>
            </div>
          </div>
        </div>

        <div className={`rounded-xl border p-3.5 ${cardCls}`}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className={iconBoxCls}><Wrench size={14} /></div>
            <div>
              <h2 className="text-xs font-bold">Herramientas del Dispositivo</h2>
              <p className={`text-[11px] ${mutedCls}`}>Reinicia o accede a modos especiales de recuperación.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <QuickAction dark={dark} icon={<RefreshCw size={14} />} title="Reinicio Normal" sub="Al sistema principal" onClick={() => run('reboot', 'Reiniciando')} />
            <QuickAction dark={dark} icon={<PowerOff size={14} />} title="Apagado" sub="Forma segura" onClick={() => run('power_off', 'Apagando')} />
            <QuickAction dark={dark} icon={<Settings size={14} />} title="Arranque" sub="Modo Fastboot" onClick={() => run('reboot_bootloader', 'Reiniciando a modo Arranque')} />
            <QuickAction dark={dark} icon={<Settings size={14} />} title="Recuperación" sub="Modo Recovery" onClick={() => run('reboot_recovery', 'Reiniciando a modo Recuperación')} />
          </div>
          <p className={`text-[10px] ${mutedCls} uppercase tracking-wider font-bold mb-1.5 px-0.5`}>Comandos Fastboot</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <QuickAction dark={dark} icon={<RefreshCw size={14} />} title="Reiniciar Fastboot" sub="Volver a Android" onClick={() => run('fastboot_reboot', 'Reiniciando desde Fastboot')} />
            <QuickAction dark={dark} icon={<Settings size={14} />} title="Recovery" sub="Salto directo" onClick={() => run('fastboot_reboot_recovery', 'Entrando a Recovery')} />
            <QuickAction dark={dark} icon={<PowerOff size={14} />} title="Restablecer" sub="Borrado Fastboot" onClick={() => { if (confirm('¿FORMATEAR el teléfono vía Fastboot?')) run('fastboot_erase', 'Formateando...'); }} />
          </div>
        </div>

        <div className={`rounded-xl border p-3.5 ${cardCls}`}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2.5">
              <div className={iconBoxCls}><Cpu size={14} /></div>
              <div>
                <h2 className="text-xs font-bold">Diagnóstico de Hardware</h2>
                <p className={`text-[11px] ${mutedCls}`}>Lectura en tiempo real de CPU, RAM y kernel.</p>
              </div>
            </div>
            <Button
              variant="secondary" size="sm"
              icon={diagLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              onClick={loadDiagnostics} disabled={diagLoading || !dev} aria-label="Analizar diagnóstico"
            >
              {diagLoading ? 'Analizando...' : 'Analizar'}
            </Button>
          </div>

          {!diagData && !diagLoading && (
            <div className={`flex flex-col items-center justify-center py-5 ${mutedCls} text-center`}>
              <HardDrive size={24} className="mb-2 opacity-50" />
              <p className="text-xs font-medium">Presiona «Analizar» para leer el estado real del hardware</p>
            </div>
          )}

          {diagData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-1">
              {Object.entries(diagData).map(([k, v]) => (
                <div key={k} className={`flex items-center justify-between py-1.5 border-b ${dark ? 'border-zinc-800' : 'border-slate-200'} last:border-0`}>
                  <span className={`text-xs ${mutedCls} flex items-center gap-1.5`}>
                    {k.includes('RAM') ? <Thermometer size={12} /> : k.includes('Tiempo') ? <Clock size={12} /> : <HardDrive size={12} />}
                    {k}
                  </span>
                  <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-slate-100 border-slate-200 text-slate-900'}`}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DriverManagerPanel />
      </div>
    </ViewShell>
  );
}
