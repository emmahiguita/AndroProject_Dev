// ============================================================================
// ARCHIVO: DeviceInfoPrimitives.tsx
// QUÉ HACE: Provee los subcomponentes reutilizables `ToggleRow` y `ToolButton`
//           para el panel de estudio y herramientas de proyección.
// CÓMO FUNCIONA: Componentes presentacionales puros parametrizados por tema
//           (`dark`), icono, etiqueta, estado y callback.
// POR QUÉ: Compartir estos bloques entre las tarjetas de iOS, Android y
//           herramientas evita duplicación y mantiene cada archivo < 200 líneas.
// ============================================================================

'use client';

import React from 'react';

export function ToggleRow({
  dark,
  icon,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  dark: boolean;
  icon: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer select-none transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : dark ? 'hover:bg-zinc-900/60' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0">
          <span className={`text-[11px] font-medium block leading-tight ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>
            {label}
          </span>
          {description && (
            <span className={`text-[10px] block leading-tight ${dark ? 'text-zinc-500' : 'text-slate-600'}`}>
              {description}
            </span>
          )}
        </div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={`w-3.5 h-3.5 rounded cursor-pointer ${dark ? 'accent-zinc-200' : 'accent-slate-900'}`}
      />
    </label>
  );
}

export function ToolButton({
  dark,
  icon,
  label,
  onClick,
  danger,
}: {
  dark: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors text-xs font-medium border cursor-pointer ${
        danger
          ? dark
            ? 'text-rose-400 bg-zinc-900/50 hover:bg-zinc-800/80 border-zinc-800/80'
            : 'text-red-600 bg-slate-50 hover:bg-slate-100 border-slate-200'
          : dark
            ? 'text-zinc-300 bg-zinc-900/50 hover:bg-zinc-800/80 border-zinc-800/80 hover:text-zinc-100'
            : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
