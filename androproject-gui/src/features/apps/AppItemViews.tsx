// ============================================================================
// ARCHIVO: AppItemViews.tsx
// QUÉ HACE: Renderiza una aplicación Android en formato tarjeta (AppCard) o
//           fila (AppRow) con su icono real extraído del APK y 6 acciones ADB:
//           Abrir, Detener, Limpiar Datos, Extraer APK, Habilitar/Deshab y Quitar.
// CÓMO FUNCIONA: Usa `RealAppIcon`, protege paquetes `criticalSystem` contra
//           desinstalación/deshabilitación y mantiene estética neutra de estudio.
// POR QUÉ: Desacoplar la presentación de cada ítem del panel principal (< 195L).
// ============================================================================

'use client';

import React from 'react';
import {
  Trash2, Eye, EyeOff, ShieldCheck, Lock, AlertTriangle,
  Check, Play, Square, Eraser, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RealAppIcon } from '@/components/ui/RealAppIcon';
import { formatBytes, formatDate } from './app-formatters';
import type { AppInfo } from '../types';

export interface AppItemProps {
  app: AppInfo;
  dark: boolean;
  serial?: string;
  selected: boolean;
  actionLoading: boolean;
  onToggleSelect: () => void;
  onLaunch: () => void;
  onForceStop: () => void;
  onClearData: () => void;
  onExtractApk: () => void;
  onUninstall: () => void;
  onDisable: () => void;
  onEnable: () => void;
}

function AppBadges({ app, dark }: { app: AppInfo; dark: boolean }) {
  const neutral = dark ? 'bg-zinc-900 text-zinc-300 border-zinc-700' : 'bg-slate-100 text-slate-700 border-slate-300';
  const danger = dark ? 'bg-zinc-900 text-red-300 border-zinc-700' : 'bg-slate-100 text-red-700 border-slate-300';
  const pill = 'inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border font-semibold';

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {app.safeToRemove && <span className={`${pill} ${neutral}`}><ShieldCheck size={9} /> SEGURO</span>}
      {app.criticalSystem && <span className={`${pill} ${neutral}`}><Lock size={9} /> CRÍTICO</span>}
      {app.isBloatware && <span className={`${pill} ${neutral}`}><Trash2 size={9} /> BLOAT</span>}
      {app.isMalware && <span className={`${pill} ${danger}`} title={app.threatName}><AlertTriangle size={9} /> {app.threatName || 'AMENAZA'}</span>}
      {app.hasOverlay && <span className={`${pill} ${danger}`} title="Permiso SYSTEM_ALERT_WINDOW activo (puede mostrar publicidad emergente)"><AlertTriangle size={9} /> PUBLICIDAD / OVERLAY</span>}
      {app.isHidden && !app.isSystem && <span className={`${pill} ${danger}`} title="App de usuario sin icono en el launcher"><EyeOff size={9} /> OCULTA</span>}
      {app.isDisabled && <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${neutral}`}>DESACTIVADA</span>}
    </div>
  );
}

function SelectBox({ dark, selected, onClick }: { dark: boolean; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={selected ? 'Deseleccionar aplicación' : 'Seleccionar aplicación'}
      className={`w-5 h-5 min-h-0 rounded border flex items-center justify-center shrink-0 transition-colors ${
        selected
          ? dark ? 'bg-zinc-100 border-zinc-100 text-zinc-950' : 'bg-slate-900 border-slate-900 text-white'
          : dark ? 'border-zinc-700 bg-zinc-900' : 'border-slate-300 bg-white'
      }`}
    >
      {selected && <Check size={11} strokeWidth={3} />}
    </button>
  );
}

function QuickUtilButtons({
  dark, disabled, isCritical, onLaunch, onForceStop, onClearData, onExtractApk,
}: {
  dark: boolean; disabled: boolean; isCritical?: boolean;
  onLaunch: () => void; onForceStop: () => void; onClearData: () => void; onExtractApk: () => void;
}) {
  const cls = `p-1.5 rounded-lg border text-[10px] font-medium inline-flex items-center justify-center gap-1 transition-colors disabled:opacity-40 ${
    dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
  }`;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button type="button" onClick={onLaunch} disabled={disabled} title="Abrir aplicación en el teléfono" className={cls}>
        <Play size={11} /> <span>Abrir</span>
      </button>
      <button type="button" onClick={onForceStop} disabled={disabled} title="Forzar detención del proceso (am force-stop)" className={cls}>
        <Square size={11} /> <span>Parar</span>
      </button>
      <button type="button" onClick={onClearData} disabled={disabled || isCritical} title="Limpiar caché y datos (pm clear)" className={cls}>
        <Eraser size={11} />
      </button>
      <button type="button" onClick={onExtractApk} disabled={disabled} title="Extraer / respaldar APK a la PC" className={cls}>
        <Download size={11} />
      </button>
    </div>
  );
}

export function AppCard(props: AppItemProps) {
  const {
    app, dark, serial, selected, actionLoading, onToggleSelect,
    onLaunch, onForceStop, onClearData, onExtractApk, onUninstall, onDisable, onEnable,
  } = props;
  const fallbackBg = dark ? '#27272a' : '#475569';

  return (
    <div className={`relative rounded-xl border p-3 flex flex-col gap-2 transition-colors ${
      selected
        ? dark ? 'bg-zinc-900 border-zinc-600' : 'bg-slate-100 border-slate-400'
        : dark ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700' : 'bg-white border-slate-200 hover:border-slate-300'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <RealAppIcon packageName={app.packageName} appName={app.name || app.packageName} serial={serial} fallbackColor={fallbackBg} sizeClass="w-9 h-9" />
        <SelectBox dark={dark} selected={selected} onClick={onToggleSelect} />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text-primary" title={app.name}>{app.name || app.packageName}</p>
        <p className="truncate font-mono text-2xs text-text-secondary" title={app.packageName}>{app.packageName}</p>
      </div>

      <AppBadges app={app} dark={dark} />

      <div className={`mt-auto pt-2 border-t flex items-center justify-between text-[10px] ${dark ? 'border-zinc-800 text-zinc-400' : 'border-slate-200 text-slate-600'}`}>
        <span>{formatBytes(app.size)}</span>
        <span>{formatDate(app.date)}</span>
      </div>

      <QuickUtilButtons dark={dark} disabled={actionLoading} isCritical={app.criticalSystem} onLaunch={onLaunch} onForceStop={onForceStop} onClearData={onClearData} onExtractApk={onExtractApk} />

      <div className="flex gap-1.5">
        <Button variant="danger" size="sm" icon={<Trash2 size={11} />} className="flex-1 px-1.5" disabled={actionLoading || app.criticalSystem} onClick={onUninstall}>Quitar</Button>
        {app.isDisabled ? (
          <Button variant="primary" size="sm" icon={<Eye size={11} />} className="flex-1 px-1.5" disabled={actionLoading} onClick={onEnable}>Activar</Button>
        ) : (
          <Button variant="outline" size="sm" icon={<EyeOff size={11} />} className="flex-1 px-1.5" disabled={actionLoading || app.criticalSystem} onClick={onDisable}>Deshab.</Button>
        )}
      </div>
    </div>
  );
}

export function AppRow(props: AppItemProps) {
  const {
    app, dark, serial, selected, actionLoading, onToggleSelect,
    onLaunch, onForceStop, onClearData, onExtractApk, onUninstall, onDisable, onEnable,
  } = props;
  const fallbackBg = dark ? '#27272a' : '#475569';

  return (
    <div className={`flex flex-wrap sm:flex-nowrap items-center gap-3 p-2.5 rounded-xl border transition-colors ${
      selected
        ? dark ? 'bg-zinc-900 border-zinc-600' : 'bg-slate-100 border-slate-400'
        : dark ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700' : 'bg-white border-slate-200 hover:border-slate-300'
    }`}>
      <SelectBox dark={dark} selected={selected} onClick={onToggleSelect} />
      <RealAppIcon packageName={app.packageName} appName={app.name || app.packageName} serial={serial} fallbackColor={fallbackBg} sizeClass="w-9 h-9" />
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold text-text-primary" title={app.name}>{app.name || app.packageName}</p>
        <p className="truncate font-mono text-2xs text-text-secondary" title={app.packageName}>{app.packageName}</p>
        <div className="mt-1"><AppBadges app={app} dark={dark} /></div>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <span className={`text-[10px] hidden lg:inline ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>{formatBytes(app.size)}</span>
        <QuickUtilButtons dark={dark} disabled={actionLoading} isCritical={app.criticalSystem} onLaunch={onLaunch} onForceStop={onForceStop} onClearData={onClearData} onExtractApk={onExtractApk} />
        <Button variant="danger" size="sm" icon={<Trash2 size={11} />} disabled={actionLoading || app.criticalSystem} onClick={onUninstall}>Quitar</Button>
        {app.isDisabled ? (
          <Button variant="primary" size="sm" icon={<Eye size={11} />} disabled={actionLoading} onClick={onEnable}>Activar</Button>
        ) : (
          <Button variant="outline" size="sm" icon={<EyeOff size={11} />} disabled={actionLoading || app.criticalSystem} onClick={onDisable}>Deshab.</Button>
        )}
      </div>
    </div>
  );
}
