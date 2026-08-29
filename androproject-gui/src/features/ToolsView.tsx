'use client';

import { useState } from 'react';
import { RefreshCw, PowerOff, Settings, Wrench, Loader2, Cpu, HardDrive, Thermometer, Clock } from 'lucide-react';
import { QuickAction } from '@/components/ui/dashboard-components';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { useActions } from '@/hooks/useActions';
import { ViewShell } from '@/components/ViewShell';
import { DeviceInfo } from './types';

interface ToolsViewProps {
  device?: DeviceInfo | null;
}

export function ToolsView({ device }: ToolsViewProps = {}) {
  const { t, dark } = useTheme();
  const { run } = useActions();
  const activeSerial = useAppStore((s) => s.activeSerial);
  const storeDevice = useAppStore((s) => s.device);
  const dev = device || storeDevice;

  // ── Diagnostics ──
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
          'RAM Total': (d.ram as Record<string,string>)?.memtotal || '--',
          'RAM Libre': (d.ram as Record<string,string>)?.memavailable || '--',
          'Almacenamiento Total': (d.storage as Record<string,string>)?.size || '--',
          'Almacenamiento Libre': (d.storage as Record<string,string>)?.free || '--',
          'Resolución': d.display_resolution || '--',
          'DPI': d.display_dpi || '--',
        });
      }
    } catch { /* errores silenciados pero diagLoading se limpia en finally */ }
    finally { setDiagLoading(false); }
  };

  return (
    <ViewShell navId="tools">
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-3 pb-12">
        {/* ── Page Header ── */}
        <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl px-4 py-3`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${dark ? 'bg-[#1bae6e]/15 text-[#22c97d]' : 'bg-emerald-100 text-emerald-600'}`}>
              <Wrench size={16} />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${t.text}`}>Herramientas ADB & Diagnóstico</h2>
              <p className={`text-xs ${t.textMuted}`}>Diagnósticos de hardware, controles de energía y reinicios a modos especiales.</p>
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
      </div>
    </ViewShell>
  );
}


