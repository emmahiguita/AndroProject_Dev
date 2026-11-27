// ============================================================================
// ARCHIVO: DeveloperOptionsPanel.tsx
// QUÉ HACE: Panel interactivo completo para activar el Modo Desarrollador,
//           abrirlo en el móvil y usar todas sus opciones individuales en vivo
//           (Trazado, Animaciones, GPU/HWUI, Procesos, Pantalla y DPI).
// CÓMO FUNCIONA: Sincroniza con `useAppStore` (`optimizerSlice`) y despacha
//           `set_developer_mode`, `open_developer_settings`, `set_developer_option`,
//           `set_animation_scale`, `set_dpi`, `set_peak_refresh` y `set_demo_mode`.
// POR QUÉ: Cumplir la auditoría de Modo Desarrollador y conectar todos los
//          setters de pantalla/GPU/procesos en < 200 líneas (SRP).
// ============================================================================
'use client';
import { apiUrl } from '@/lib/api-url';

import React, { useState, useEffect, useCallback } from 'react';
import { Power, ExternalLink, Smartphone, Cpu, Eye, Layers, Monitor, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { PerfStatus } from './TurboBoostPanel';

interface DeveloperOptionsPanelProps {
  serial: string | null;
  addLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onRefreshGlobalSettings: () => void;
}

const ANIM_VALUES = ['0.0', '0.5', '1.0', '1.5', '2.0'] as const;

export const DeveloperOptionsPanel: React.FC<DeveloperOptionsPanelProps> = ({ serial, addLog, onRefreshGlobalSettings }) => {
  const { dark } = useTheme();
  const s = useAppStore();
  const [devStatus, setDevStatus] = useState<PerfStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dpiDraft, setDpiDraft] = useState<string | null>(null);
  const dpiInput = dpiDraft ?? String(s.currentDpi ?? '');

  const loadDevStatus = useCallback(async () => {
    if (!serial) return;
    try {
      const r = await fetch(apiUrl('/api/actions'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_perf_status', serial }),
      });
      const d = await r.json();
      if (d.success && d.status) setDevStatus(d.status);
    } catch {}
  }, [serial]);

  useEffect(() => { void Promise.resolve().then(loadDevStatus); }, [loadDevStatus]);

  const postAction = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!serial) { addLog('Conecta un dispositivo Android por ADB.', 'error'); return; }
    setBusy(action);
    try {
      const r = await fetch(apiUrl('/api/actions'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, serial, ...payload }),
      });
      const d = await r.json();
      if (d.status) setDevStatus(d.status);
      addLog(d.message || d.error || action, d.success ? 'success' : 'error');
      onRefreshGlobalSettings();
    } catch { addLog(`Error ejecutando ${action}`, 'error'); }
    finally { setBusy(null); }
  };

  const chipCls = (active: boolean) =>
    `px-2 py-1 rounded border text-[11px] font-mono font-semibold transition-colors cursor-pointer disabled:opacity-65 ${
      active ? (dark ? 'bg-zinc-100 text-zinc-950 border-zinc-100' : 'bg-slate-900 text-white border-slate-900')
             : (dark ? 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100')
    }`;
  const rowCls = `flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border ${dark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-200'}`;

  const toggles = [
    { key: 'stay_awake', title: 'Mantener pantalla activa al cargar', sub: 'stay_on_while_plugged_in', on: Boolean(devStatus?.stayAwake ?? s.stayAwake) },
    { key: 'show_touches', title: 'Mostrar toques táctiles', sub: 'system show_touches', on: Boolean(devStatus?.showTouches ?? s.showTouches) },
    { key: 'pointer_location', title: 'Ubicación del puntero (XY)', sub: 'system pointer_location', on: Boolean(devStatus?.pointerLocation) },
    { key: 'debug_layout', title: 'Mostrar límites de diseño (Layout Bounds)', sub: 'debug.layout', on: Boolean(devStatus?.debugLayout) },
    { key: 'adb_wifi', title: 'Depuración inalámbrica por Wi-Fi', sub: 'adb_wifi_enabled', on: Boolean(devStatus?.wifiDebugging) },
    { key: 'dont_keep_activities', title: 'No conservar actividades al salir', sub: 'always_finish_activities', on: Boolean(devStatus?.dontKeepActivities) },
  ];

  const anims = [
    { type: 'window', label: 'Animación de ventana', val: devStatus?.windowScale || s.animScales.window_animation_scale },
    { type: 'transition', label: 'Animación de transición', val: devStatus?.transitionScale || s.animScales.transition_animation_scale },
    { type: 'animator', label: 'Duración de animador', val: devStatus?.animatorScale || s.animScales.animator_duration_scale },
  ] as const;

  return (
    <div className="space-y-3">
      <Card padding="md" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold flex items-center gap-1.5"><Power size={14} /> Control Maestro del Modo Desarrollador</h3>
            <p className="text-[11px] text-text-secondary">Activa `development_settings_enabled=1`, abre el menú en el móvil o salta a Compilación.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="primary" icon={<Power size={12} />} disabled={!serial || busy !== null} onClick={() => postAction('auto_activate_dev_mode')}>Activar Todo Automático</Button>
            <Button size="sm" variant={devStatus?.developerMode ? 'primary' : 'secondary'} icon={<Power size={12} />} disabled={!serial || busy !== null} onClick={() => postAction('set_developer_mode', { enabled: !devStatus?.developerMode })}>{devStatus?.developerMode ? 'Dev Mode: ACTIVO' : 'Dev Mode: OFF'}</Button>
            <Button size="sm" variant="secondary" icon={<ExternalLink size={12} />} disabled={!serial || busy !== null} onClick={() => postAction('open_developer_settings', { screen: 'dev' })}>Abrir en Teléfono</Button>
            <Button size="sm" variant="secondary" icon={<Smartphone size={12} />} disabled={!serial || busy !== null} onClick={() => postAction('open_developer_settings', { screen: 'about' })}>Compilación</Button>
            <Button size="sm" variant="secondary" icon={<RefreshCw size={12} />} disabled={!serial || busy !== null} onClick={loadDevStatus}>Sincronizar</Button>
          </div>
        </div>
      </Card>

      <Card padding="md" className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Eye size={13} /> Trazado Visual, Entrada y Depuración</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {toggles.map((item) => (
            <div key={item.key} className={rowCls}>
              <div className="min-w-0"><p className="text-xs font-semibold truncate">{item.title}</p><p className="text-[10px] font-mono text-text-secondary">{item.sub}</p></div>
              <button type="button" disabled={!serial || busy !== null || !devStatus} onClick={() => postAction('set_developer_option', { option: item.key, value: !item.on })} className={chipCls(item.on)}>{!devStatus ? 'Sin lectura' : item.on ? 'ACTIVO' : 'INACTIVO'}</button>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="md" className="space-y-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Layers size={13} /> Escalas de Animación y Renderizado GPU (HWUI)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {anims.map((anim) => (
            <div key={anim.type} className={rowCls}>
              <span className="text-xs font-semibold">{anim.label}</span>
              <div className="flex flex-wrap gap-1">
                {ANIM_VALUES.map((v) => (<button key={v} type="button" disabled={!serial || busy !== null} onClick={() => postAction('set_animation_scale', { type: anim.type, value: v })} className={chipCls(anim.val === v)}>{v}x</button>))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
          <div className={rowCls}>
            <div><p className="text-xs font-semibold">Motor de Renderizado GPU</p><p className="text-[10px] font-mono text-text-secondary">debug.hwui.renderer</p></div>
            <div className="flex gap-1">
              {[{ id: 'default', label: 'Auto' }, { id: 'skiagl', label: 'SkiaGL' }, { id: 'skiavk', label: 'Vulkan' }].map((g) => (
                <button key={g.id} type="button" disabled={!serial || busy !== null} onClick={() => postAction('set_gpu_renderer', { renderer: g.id })} className={chipCls(devStatus?.gpuRenderer === g.id)}>{g.label}</button>
              ))}
            </div>
          </div>

          <div className={rowCls}>
            <div><p className="text-xs font-semibold">Superposiciones HW / 4x MSAA / Blur</p><p className="text-[10px] font-mono text-text-secondary">Composición GPU directa</p></div>
            <div className="flex flex-wrap gap-1">
              <button type="button" disabled={!serial || busy !== null} onClick={() => postAction('set_developer_option', { option: 'disable_hw_overlays', value: true })} className={chipCls(false)}>Sin Overlays HW</button>
              <button type="button" disabled={!serial || busy !== null} onClick={() => postAction('set_developer_option', { option: 'force_msaa', value: !devStatus?.forceMsaa })} className={chipCls(Boolean(devStatus?.forceMsaa))}>4x MSAA</button>
              <button type="button" disabled={!serial || busy !== null} onClick={() => postAction('set_developer_option', { option: 'disable_blur', value: !devStatus?.disableBlur })} className={chipCls(Boolean(devStatus?.disableBlur))}>Sin Blur</button>
            </div>
          </div>
        </div>
      </Card>

      <Card padding="md" className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Cpu size={13} /> Procesos en Segundo Plano, Refresco Hz y Densidad DPI</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className={rowCls}>
            <span className="text-xs font-semibold">Límite procesos fondo</span>
            <div className="flex gap-1">
              {(['standard', '4', '3', '2', '1'] as const).map((lim) => (
                <button key={lim} type="button" disabled={!serial || busy !== null} onClick={() => postAction('set_bg_limit', { limit: lim })} className={chipCls(devStatus?.bgLimit === lim)}>{lim === 'standard' ? 'Estándar' : `${lim} máx`}</button>
              ))}
            </div>
          </div>

          <div className={rowCls}>
            <span className="text-xs font-semibold">Congelador de apps en caché</span>
            <div className="flex gap-1">
              {(['default', 'enabled', 'disabled'] as const).map((fz) => (
                <button key={fz} type="button" disabled={!serial || busy !== null} onClick={() => postAction('set_cached_freezer', { mode: fz })} className={chipCls(devStatus?.cachedFreezer === fz)}>{fz === 'default' ? 'Auto' : fz === 'enabled' ? 'Activo' : 'Off'}</button>
              ))}
            </div>
          </div>

          <div className={rowCls}>
            <span className="text-xs font-semibold flex items-center gap-1"><Monitor size={12} /> Tasa de refresco pico</span>
            <div className="flex gap-1">
              {[60, 90, 120].map((hz) => (
                <button key={hz} type="button" disabled={!serial || busy !== null} onClick={() => postAction('set_peak_refresh', { hz })} className={chipCls(Number(devStatus?.peakRefresh) === hz)}>{hz}Hz</button>
              ))}
            </div>
          </div>

          <div className={rowCls}>
            <span className="text-xs font-semibold">Densidad DPI ({s.currentDpi == null ? 'Sin lectura' : `${s.currentDpi} dpi`})</span>
            <div className="flex items-center gap-1">
              <input type="number" min={160} max={640} value={dpiInput} onChange={(e) => setDpiDraft(e.target.value)} className={`w-16 px-2 py-1 rounded border text-xs font-mono ${dark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-slate-300 text-slate-900'}`} />
              <button type="button" disabled={!serial || busy !== null || !dpiInput || Number(dpiInput) < 160 || Number(dpiInput) > 640} onClick={() => postAction('set_dpi', { dpi: Number(dpiInput) })} className={chipCls(false)}>Aplicar</button>
              <button type="button" disabled={!serial || busy !== null} onClick={() => postAction('set_demo_mode', { enabled: true })} className={chipCls(false)}>Demo UI</button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
