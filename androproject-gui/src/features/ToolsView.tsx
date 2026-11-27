// ============================================================================
// ARCHIVO: ToolsView.tsx
// QUÉ HACE: Vista completa de Herramientas ADB, reinicios especiales (ADB y
//           Fastboot), utilidades rápidas de ingeniería (Wi-Fi 5555, Modo
//           Desarrollador, App en primer plano, TRIM, reparación de capturas),
//           diagnóstico forense de hardware y DriverManager USB Windows.
// CÓMO FUNCIONA: Conecta todas las acciones de `useActions` y `/api/actions`,
//           sincronizando `diagnostics` y `foregroundApp` en `useAppStore`.
// POR QUÉ: Eliminar acciones huérfanas y mostrar el 100% de métricas (< 200L).
// ============================================================================
'use client';
import { apiUrl } from '@/lib/api-url';

import { useState } from 'react';
import {
  RefreshCw, PowerOff, Settings, Wrench, Loader2, Cpu, HardDrive,
  Thermometer, Clock, Wifi, Eye, Trash2, Shield, Battery,
} from 'lucide-react';
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
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function ToolsView({ device, addLog: propAddLog }: ToolsViewProps = {}) {
  const { dark } = useTheme();
  const { run } = useActions();
  const s = useAppStore();
  const dev = device || s.device;
  const targetSerial = s.activeSerial || dev?.serial || null;

  const [diagData, setDiagData] = useState<Record<string, string> | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [toolBanner, setToolBanner] = useState<string | null>(null);

  const log = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToolBanner(msg);
    if (propAddLog) propAddLog(msg, type);
    else s.addLog(msg);
  };

  const loadDiagnostics = async () => {
    if (!targetSerial) return;
    setDiagLoading(true);
    try {
      const res = await fetch(apiUrl('/api/actions'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_diagnostics', serial: targetSerial }),
      });
      const data = await res.json();
      if (!data.success || !data.diagnostics) { setDiagData(null); log(data.error || 'Sin lectura de diagnóstico', 'error'); return; }
      if (data.diagnostics) {
        const d = data.diagnostics;
        s.setDiagnostics(d);
        const cpuObj = (d.cpu || {}) as Record<string, string>;
        const ramObj = (d.ram || {}) as Record<string, string>;
        const stObj = (d.storage || {}) as Record<string, string>;
        const tempC = d.battery_temperature ? `${(parseInt(d.battery_temperature, 10) / 10).toFixed(1)} °C` : '--';
        const voltV = d.battery_voltage ? `${(parseInt(d.battery_voltage, 10) / 1000).toFixed(2)} V` : '--';
        setDiagData({
          'Procesador / SoC': cpuObj.hardware || cpuObj.processor || '--',
          'Núcleos / ABI': `${cpuObj.cores || '--'} núcleos (${d.arch || '--'})`,
          'SDK Android / Kernel': `API ${d.sdk || '--'} · ${d.kernel || '--'}`,
          'Tiempo activo (Uptime)': d.uptime || '--',
          'RAM Total / Disponible': `${ramObj.memtotal || '--'} / ${ramObj.memavailable || '--'}`,
          'Almacenamiento (/data)': stObj.size ? `${stObj.used || '--'} / ${stObj.size} (${stObj.free || '--'} libre · ${stObj.usage || '--'})` : '--',
          'Batería Nivel / Temperatura': `${d.battery_level ? d.battery_level + '%' : '--'} · ${tempC}`,
          'Batería Voltaje / Tecnología': `${voltV} · ${d.battery_technology || 'Sin lectura'}`,
          'Sensores Térmicos': Array.isArray(d.thermal) && d.thermal.length > 0 ? d.thermal.slice(0, 3).join(' | ') : tempC,
          'Resolución / Densidad DPI': `${d.display_resolution || '--'} · ${d.display_dpi || '--'}`,
        });
        log('Diagnóstico forense de hardware actualizado.', 'success');
      }
    } catch { log('Error al consultar diagnóstico de hardware.', 'error'); }
    finally { setDiagLoading(false); }
  };

  const handleCheckForeground = async () => {
    const res = await run('get_foreground_app', 'Detectando app en primer plano');
    if (res.success && res.package) {
      s.setForegroundApp(res.package);
      log(`App activa en primer plano: ${res.package}`, 'success');
    } else log(res.error || 'No se pudo detectar la app en primer plano', 'error');
  };

  const cardCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900 shadow-sm';
  const iconBoxCls = `w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
    dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'
  }`;
  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';

  return (
    <ViewShell navId="tools">
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-3 pb-12">
        <div className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2 ${cardCls}`}>
          <div className="flex items-center gap-2.5">
            <div className={iconBoxCls}><Wrench size={16} /></div>
            <div>
              <h2 className="text-sm font-bold">Herramientas ADB, Ingeniería &amp; Diagnóstico Forense</h2>
              <p className={`text-xs ${mutedCls}`}>Controles de energía, utilidades del Modo Desarrollador, sensores de kernel y drivers USB.</p>
            </div>
          </div>
          {s.foregroundApp && s.foregroundApp !== 'Buscando...' && (
            <span className={`text-[11px] font-mono px-2.5 py-1 rounded border ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-800'}`}>
              En pantalla: <strong>{s.foregroundApp}</strong>
            </span>
          )}
        </div>

        {toolBanner && (
          <div className={`rounded-xl border px-3.5 py-2 text-xs font-mono ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
            {toolBanner}
          </div>
        )}

        <div className={`rounded-xl border p-3.5 ${cardCls}`}>
          <p className={`text-[10px] ${mutedCls} uppercase tracking-wider font-bold mb-2`}>Controles de Energía y Modos de Arranque (ADB &amp; Fastboot)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5">
            <QuickAction dark={dark} icon={<RefreshCw size={14} />} title="Reinicio Normal" sub="Al sistema Android" onClick={() => run('reboot', 'Reiniciando dispositivo')} />
            <QuickAction dark={dark} icon={<PowerOff size={14} />} title="Apagado Seguro" sub="reboot -p" onClick={() => run('power_off', 'Apagando dispositivo')} />
            <QuickAction dark={dark} icon={<Settings size={14} />} title="Bootloader" sub="Entrar a Fastboot" onClick={() => run('reboot_bootloader', 'Reiniciando a Bootloader')} />
            <QuickAction dark={dark} icon={<Settings size={14} />} title="Recovery" sub="Modo Recuperación" onClick={() => run('reboot_recovery', 'Reiniciando a Recovery')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <QuickAction dark={dark} icon={<RefreshCw size={14} />} title="Reiniciar desde Fastboot" sub="Volver a Android" onClick={() => run('fastboot_reboot', 'Reiniciando desde Fastboot')} />
            <QuickAction dark={dark} icon={<Settings size={14} />} title="Fastboot → Recovery" sub="Salto directo" onClick={() => run('fastboot_reboot_recovery', 'Saltando a Recovery')} />
            <QuickAction dark={dark} color="danger" icon={<PowerOff size={14} />} title="Factory Reset Fastboot" sub="Borrado userdata/metadata" onClick={() => { if (confirm('¿FORMATEAR el teléfono vía Fastboot?')) run('fastboot_erase', 'Formateando...'); }} />
          </div>
        </div>

        <div className={`rounded-xl border p-3.5 ${cardCls}`}>
          <p className={`text-[10px] ${mutedCls} uppercase tracking-wider font-bold mb-2`}>Utilidades de Ingeniería y Modo Desarrollador</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <QuickAction dark={dark} icon={<Wifi size={14} />} title="ADB Wi-Fi 5555" sub="Activar y auto-conectar IP" onClick={async () => { const r = await run('enable_wifi', 'Activando ADB Wi-Fi 5555'); log(r.message || r.error || 'ADB Wi-Fi procesado', r.success ? 'success' : 'error'); }} />
            <QuickAction dark={dark} icon={<Settings size={14} />} title="Opciones Desarrollador" sub="Activar y abrir en móvil" onClick={async () => { const r = await run('open_developer_settings', 'Abriendo Opciones de Desarrollador', { screen: 'dev' }); log(r.message || r.error || 'Comando enviado', r.success ? 'success' : 'error'); }} />
            <QuickAction dark={dark} icon={<Eye size={14} />} title="App en Primer Plano" sub="Detectar ventana activa" onClick={handleCheckForeground} />
            <QuickAction dark={dark} icon={<Trash2 size={14} />} title="Limpiar Caché (TRIM)" sub="cmd package trim-caches" onClick={async () => { const r = await run('run_trim', 'Limpiando caché de paquetes'); log(r.message || r.error || 'TRIM finalizado', r.success ? 'success' : 'error'); }} />
            <QuickAction dark={dark} icon={<Shield size={14} />} title="Reparar Capturas" sub="Desbloquear screencap" onClick={async () => { const r = await run('diagnose_screenshot', 'Diagnosticando capturas'); log(r.message || r.error || 'Diagnóstico completado', r.success ? 'success' : 'error'); }} />
            <QuickAction dark={dark} icon={<RefreshCw size={14} />} title="Reiniciar Servidor ADB" sub="kill-server + start-server" onClick={async () => { const r = await run('restart_adb', 'Reiniciando servidor ADB'); log(r.message || 'ADB reiniciado', 'success'); }} />
          </div>
        </div>

        <div className={`rounded-xl border p-3.5 ${cardCls}`}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2.5">
              <div className={iconBoxCls}><Cpu size={14} /></div>
              <div>
                <h2 className="text-xs font-bold">Diagnóstico Forense de Hardware y Sensores</h2>
                <p className={`text-[11px] ${mutedCls}`}>Lectura paralela de SoC, núcleos, RAM, `/data`, batería, voltaje y sensores térmicos.</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" icon={diagLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} onClick={loadDiagnostics} disabled={diagLoading || !targetSerial}>
              {diagLoading ? 'Analizando...' : 'Analizar Hardware'}
            </Button>
          </div>

          {!diagData && !diagLoading && (
            <div className={`flex flex-col items-center justify-center py-4 ${mutedCls} text-center`}>
              <HardDrive size={22} className="mb-1.5 opacity-50" />
              <p className="text-xs font-medium">Presiona «Analizar Hardware» para interrogar los sensores del kernel</p>
            </div>
          )}

          {diagData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-1">
              {Object.entries(diagData).map(([k, v]) => (
                <div key={k} className={`flex items-center justify-between gap-2 py-1.5 border-b ${dark ? 'border-zinc-800' : 'border-slate-200'} last:border-0`}>
                  <span className={`text-xs ${mutedCls} flex items-center gap-1.5 shrink-0`}>
                    {k.includes('Batería') ? <Battery size={12} /> : k.includes('Térmicos') ? <Thermometer size={12} /> : k.includes('Tiempo') ? <Clock size={12} /> : <HardDrive size={12} />}
                    {k}
                  </span>
                  <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border truncate max-w-[60%] ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-slate-100 border-slate-200 text-slate-900'}`} title={v}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DriverManagerPanel onLog={log} />
      </div>
    </ViewShell>
  );
}
