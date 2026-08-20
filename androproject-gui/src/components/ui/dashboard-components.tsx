'use client';

import type { ReactNode } from 'react';

type ThemeProps = { dark: boolean };

export type QuickActionProps = ThemeProps & {
  icon: ReactNode;
  title: string;
  sub: string;
  color?: 'neutral' | 'danger' | 'red' | 'blue' | 'teal' | 'amber' | 'violet' | 'slate';
  onClick: () => void;
};

export function QuickAction({ icon, title, sub, color = 'neutral', onClick, dark }: QuickActionProps) {
  const danger = color === 'danger' || color === 'red';
  const tone = danger
    ? dark ? 'border-red-500/20 text-red-400 hover:bg-red-500/[0.08]' : 'border-red-200 text-red-600 hover:bg-red-50'
    : dark ? 'border-white/[0.08] text-white/75 hover:border-emerald-500/25 hover:bg-white/[0.035]' : 'border-slate-200 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/40';
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors active:scale-[0.99] ${tone} ${dark ? 'bg-white/[0.02]' : 'bg-white shadow-sm'}`}>
      <span className={`p-1.5 rounded-lg shrink-0 ${danger ? 'bg-red-500/10' : dark ? 'bg-white/[0.05] text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>{icon}</span>
      <span className="min-w-0"><span className="block text-[11px] font-semibold truncate leading-tight">{title}</span><span className={`block text-[10px] truncate ${dark ? 'text-white/35' : 'text-slate-400'}`}>{sub}</span></span>
    </button>
  );
}
