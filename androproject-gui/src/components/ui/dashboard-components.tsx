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
    ? dark ? 'border-red-900/60 text-red-400 hover:bg-red-950/40' : 'border-red-200 text-red-700 hover:bg-red-50'
    : dark ? 'border-zinc-800 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900' : 'border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50';
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors active:scale-[0.99] ${tone} ${dark ? 'bg-zinc-950' : 'bg-white'}`}>
      <span className={`p-1.5 rounded-lg shrink-0 ${danger ? 'bg-red-500/10' : dark ? 'bg-zinc-900 text-zinc-200' : 'bg-slate-100 text-slate-700'}`}>{icon}</span>
      <span className="min-w-0"><span className="block text-[11px] font-semibold truncate leading-tight">{title}</span><span className={`block text-[10px] truncate ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>{sub}</span></span>
    </button>
  );
}
