// ============================================================================
// ARCHIVO: DeviceSettingsPanel.tsx
// QUÉ HACE: Panel interactivo de ajustes reales del sistema Android conectado
//           (Stay Awake, Mostrar Toques, Escala de Animaciones, Timeout de
//           Pantalla y activación de ADB TCP/IP 5555).
// CÓMO FUNCIONA: Lee el estado actual devuelto por `GET /api/config` y ejecuta
//           modificaciones reales mediante `POST /api/config` (`adb shell settings`).
// POR QUÉ: Inyectar lógica 100% funcional en el módulo de Ajustes con
//           componentes pequeños, limpios y sin simulaciones (< 200L, SOLID).
// ============================================================================
'use client';

import React from 'react';
import { Smartphone, Wifi, Eye, Sun, Gauge, Clock } from 'lucide-react';

export interface LiveAndroidSettings {
  stayAwake: boolean | null;
  showTouches: boolean | null;
  animScale: string | null;
  screenTimeoutMs: number | null;
  densityDpi: string | null;
}

interface DeviceSettingsPanelProps {
  dark: boolean;
  serial?: string;
  model?: string;
  settings: LiveAndroidSettings | null;
  busyAction: string | null;
  onApplySetting: (action: string, value?: string | number | boolean) => void;
}

export const DeviceSettingsPanel: React.FC<DeviceSettingsPanelProps> = ({
  dark,
  serial,
  model,
  settings,
  busyAction,
  onApplySetting,
}) => {
  const cardCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-300 text-slate-900 shadow-sm';
  const rowCls = `flex flex-wrap items-center justify-between gap-2 p-2.5 rounded border ${
    dark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
  }`;

  const chipCls = (active: boolean) =>
    `px-2.5 py-1 rounded border text-[11px] font-mono font-semibold transition-colors disabled:opacity-50 ${
      active
        ? dark ? 'bg-zinc-100 text-zinc-950 border-zinc-100' : 'bg-slate-900 text-white border-slate-900'
        : dark ? 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
    }`;

  return (
    <div className={`rounded-lg border p-3.5 space-y-2.5 ${cardCls}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Smartphone size={14} className={dark ? 'text-zinc-300' : 'text-slate-700'} />
          <h3 className="text-xs font-bold uppercase tracking-wider">
            Ajustes en Vivo del Dispositivo ({model || serial || 'Sin conexión'})
          </h3>
        </div>
        {settings && (
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
            Densidad: {settings.densityDpi ?? 'Sin lectura'}
          </span>
        )}
      </div>

      {!settings ? (
        <p className={`text-xs py-2 ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
          Conecta un dispositivo Android con depuración USB para modificar ajustes del sistema en tiempo real.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* 1. Mantener pantalla encendida al cargar */}
          <div className={rowCls}>
            <div className="flex items-center gap-2 min-w-0">
              <Sun size={14} className="shrink-0 opacity-70" />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">Pantalla activa al cargar</p>
                <p className={`text-[10px] font-mono ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>stay_on_while_plugged_in</p>
              </div>
            </div>
            <button
              type="button"
              disabled={busyAction !== null || settings.stayAwake === null}
              onClick={() => onApplySetting('set_stay_awake', !settings.stayAwake)}
              className={chipCls(settings.stayAwake === true)}
            >
              {settings.stayAwake === null ? 'Sin lectura' : settings.stayAwake ? 'ACTIVO (USB/AC)' : 'INACTIVO'}
            </button>
          </div>

          {/* 2. Mostrar puntero / toques en pantalla */}
          <div className={rowCls}>
            <div className="flex items-center gap-2 min-w-0">
              <Eye size={14} className="shrink-0 opacity-70" />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">Mostrar toques táctiles</p>
                <p className={`text-[10px] font-mono ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>system show_touches</p>
              </div>
            </div>
            <button
              type="button"
              disabled={busyAction !== null || settings.showTouches === null}
              onClick={() => onApplySetting('set_show_touches', !settings.showTouches)}
              className={chipCls(settings.showTouches === true)}
            >
              {settings.showTouches === null ? 'Sin lectura' : settings.showTouches ? 'VISIBLE' : 'OCULTO'}
            </button>
          </div>

          {/* 3. Escala de animaciones de ventana / transición */}
          <div className={rowCls}>
            <div className="flex items-center gap-2 min-w-0">
              <Gauge size={14} className="shrink-0 opacity-70" />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">Escala de animaciones UI</p>
                <p className={`text-[10px] font-mono ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>window_animation_scale</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {(['0.0', '0.5', '1.0'] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => onApplySetting('set_anim_scale', sc)}
                  className={chipCls(settings.animScale === sc)}
                >
                  {sc}x
                </button>
              ))}
            </div>
          </div>

          {/* 4. Tiempo de espera de pantalla (Screen timeout) */}
          <div className={rowCls}>
            <div className="flex items-center gap-2 min-w-0">
              <Clock size={14} className="shrink-0 opacity-70" />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">Apagado de pantalla</p>
                <p className={`text-[10px] font-mono ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>screen_off_timeout</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {[
                { label: '30s', ms: 30000 },
                { label: '1m', ms: 60000 },
                { label: '5m', ms: 300000 },
                { label: '30m', ms: 1800000 },
              ].map((t) => (
                <button
                  key={t.ms}
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => onApplySetting('set_screen_timeout', t.ms)}
                  className={chipCls(settings.screenTimeoutMs === t.ms)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Barra inferior rápida de ADB TCP/IP 5555 */}
      <div className={`flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2 text-xs">
          <Wifi size={13} className="opacity-70" />
          <span className={dark ? 'text-zinc-300' : 'text-slate-700'}>
            Depuración inalámbrica ADB TCP/IP (Puerto 5555)
          </span>
        </div>
        <button
          type="button"
          disabled={busyAction !== null || !serial}
          onClick={() => onApplySetting('enable_tcpip')}
          className={chipCls(false)}
        >
          Habilitar Puerto 5555
        </button>
      </div>
    </div>
  );
};
