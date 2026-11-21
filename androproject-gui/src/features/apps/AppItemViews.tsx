// ============================================================================
// ARCHIVO: AppItemViews.tsx
// QUÉ HACE: Renderiza una aplicación Android en formato tarjeta (AppCard) o
//           fila (AppRow) con su icono real extraído del APK y acciones ADB.
// CÓMO FUNCIONA: Usa `RealAppIcon` (con caché en disco y serial del teléfono),
//           insignias monocromas legibles en claro/oscuro y botones accesibles.
// POR QUÉ: Desacoplar la presentación de cada ítem del panel principal (<200 L)
//           y eliminar bordes neón o textos luminosos de bajo contraste.
// ============================================================================

'use client';

import React from 'react';
import { Trash2, Eye, EyeOff, ShieldCheck, Lock, AlertTriangle, Check } from 'lucide-react';
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
  onUninstall: () => void;
  onDisable: () => void;
  onEnable: () => void;
}

/** Insignias sobrias de clasificación (seguro, crítico, bloat, amenaza, desactivada). */
function AppBadges({ app, dark }: { app: AppInfo; dark: boolean }) {
  const neutral = dark
    ? 'bg-zinc-900 text-zinc-300 border-zinc-700'
    : 'bg-slate-100 text-slate-700 border-slate-300';
  const danger = dark
    ? 'bg-red-950/60 text-red-300 border-red-900'
    : 'bg-red-50 text-red-700 border-red-200';

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {app.safeToRemove && (
        <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border font-semibold ${neutral}`}>
          <ShieldCheck size={9} /> SEGURO
        </span>
      )}
      {app.criticalSystem && (
        <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border font-semibold ${neutral}`}>
          <Lock size={9} /> CRÍTICO
        </span>
      )}
      {app.isBloatware && (
        <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border font-semibold ${neutral}`}>
          <Trash2 size={9} /> BLOAT
        </span>
      )}
      {app.isMalware && (
        <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border font-semibold ${danger}`}>
          <AlertTriangle size={9} /> AMENAZA
        </span>
      )}
      {app.isDisabled && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${neutral}`}>
          DESACTIVADA
        </span>
      )}
    </div>
  );
}

/** Checkbox accesible para selección múltiple. */
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

/** Vista de aplicación en cuadrícula. */
export function AppCard(props: AppItemProps) {
  const { app, dark, serial, selected, actionLoading, onToggleSelect, onUninstall, onDisable, onEnable } = props;
  const fallbackBg = dark ? '#27272a' : '#475569';

  return (
    <div
      className={`relative rounded-xl border p-3 flex flex-col gap-2 transition-colors ${
        selected
          ? dark ? 'bg-zinc-900 border-zinc-600' : 'bg-slate-100 border-slate-400'
          : dark ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700' : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <RealAppIcon
          packageName={app.packageName}
          appName={app.name || app.packageName}
          serial={serial}
          fallbackColor={fallbackBg}
          sizeClass="w-9 h-9"
        />
        <SelectBox dark={dark} selected={selected} onClick={onToggleSelect} />
      </div>

      <div className="min-w-0">
        <p className={`text-xs font-semibold truncate ${dark ? 'text-zinc-100' : 'text-slate-900'}`} title={app.name}>
          {app.name || app.packageName}
        </p>
        <p className={`text-[10px] font-mono truncate ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
          {app.packageName}
        </p>
      </div>

      <AppBadges app={app} dark={dark} />

      <div className={`mt-auto pt-2 border-t flex items-center justify-between text-[10px] ${dark ? 'border-zinc-800 text-zinc-400' : 'border-slate-200 text-slate-600'}`}>
        <span>{formatBytes(app.size)}</span>
        <span>{formatDate(app.date)}</span>
      </div>

      <div className="flex gap-1.5">
        <Button variant="danger" size="sm" icon={<Trash2 size={11} />} className="flex-1 px-1.5" disabled={actionLoading} onClick={onUninstall}>
          Quitar
        </Button>
        {app.isDisabled ? (
          <Button variant="primary" size="sm" icon={<Eye size={11} />} className="flex-1 px-1.5" disabled={actionLoading} onClick={onEnable}>
            Activar
          </Button>
        ) : (
          <Button variant="outline" size="sm" icon={<EyeOff size={11} />} className="flex-1 px-1.5" disabled={actionLoading} onClick={onDisable}>
            Deshab.
          </Button>
        )}
      </div>
    </div>
  );
}

/** Vista de aplicación en fila horizontal. */
export function AppRow(props: AppItemProps) {
  const { app, dark, serial, selected, actionLoading, onToggleSelect, onUninstall, onDisable, onEnable } = props;
  const fallbackBg = dark ? '#27272a' : '#475569';

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
        selected
          ? dark ? 'bg-zinc-900 border-zinc-600' : 'bg-slate-100 border-slate-400'
          : dark ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700' : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      <SelectBox dark={dark} selected={selected} onClick={onToggleSelect} />
      <RealAppIcon
        packageName={app.packageName}
        appName={app.name || app.packageName}
        serial={serial}
        fallbackColor={fallbackBg}
        sizeClass="w-9 h-9"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold truncate ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
          {app.name || app.packageName}
        </p>
        <p className={`text-[10px] font-mono truncate ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
          {app.packageName}
        </p>
        <div className="mt-1">
          <AppBadges app={app} dark={dark} />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[10px] hidden sm:inline ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>{formatBytes(app.size)}</span>
        <span className={`text-[10px] hidden md:inline ${dark ? 'text-zinc-500' : 'text-slate-500'}`}>{formatDate(app.date)}</span>
        <Button variant="danger" size="sm" icon={<Trash2 size={11} />} disabled={actionLoading} onClick={onUninstall}>
          Desinstalar
        </Button>
        {app.isDisabled ? (
          <Button variant="primary" size="sm" icon={<Eye size={11} />} disabled={actionLoading} onClick={onEnable}>
            Habilitar
          </Button>
        ) : (
          <Button variant="outline" size="sm" icon={<EyeOff size={11} />} disabled={actionLoading} onClick={onDisable}>
            Deshab.
          </Button>
        )}
      </div>
    </div>
  );
}
