'use client';

import type { ReactNode } from 'react';

type ThemeProps = { dark: boolean };

type InfoRowProps = ThemeProps & {
  icon: ReactNode;
  label: string;
  value: ReactNode;
};

export function InfoRow({ icon, label, value, dark }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className={`shrink-0 flex items-center justify-center p-1.5 rounded-lg ${dark ? 'bg-white/[0.05] text-white/45' : 'bg-slate-100 text-slate-500'}`}>{icon}</span>
      <span className={`shrink-0 text-xs font-medium ${dark ? 'text-white/45' : 'text-slate-500'}`}>{label}</span>
      <span className={`truncate text-xs font-semibold ml-auto ${dark ? 'text-white/85' : 'text-slate-800'}`}>{value}</span>
    </div>
  );
}

type StateTone = 'green' | 'blue' | 'violet' | 'emerald';
type StateCardProps = ThemeProps & {
  icon: ReactNode;
  title: string;
  value: ReactNode;
  sub: string;
  color: StateTone;
  progress?: number;
};

const stateTone: Record<StateTone, { icon: string; text: string; bar: string }> = {
  green: { icon: 'bg-emerald-500/10 text-emerald-400', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  emerald: { icon: 'bg-emerald-500/10 text-emerald-400', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  blue: { icon: 'bg-sky-500/10 text-sky-400', text: 'text-sky-400', bar: 'bg-sky-500' },
  violet: { icon: 'bg-violet-500/10 text-violet-400', text: 'text-violet-400', bar: 'bg-violet-500' },
};

export function StateCard({ icon, title, value, sub, color, progress, dark }: StateCardProps) {
  const tone = stateTone[color];
  const safeProgress = Math.max(0, Math.min(progress ?? 0, 100));
  return (
    <article className={`rounded-xl border p-4 ${dark ? 'bg-white/[0.025] border-white/[0.07]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className={`w-9 h-9 rounded-xl ${tone.icon} flex items-center justify-center mb-3`}>{icon}</div>
      <p className={`text-[10px] uppercase tracking-wider font-semibold ${dark ? 'text-white/40' : 'text-slate-500'}`}>{title}</p>
      <p className="text-lg font-bold mt-1 tracking-tight">{value}</p>
      <p className={`text-[11px] ${tone.text} mt-1 font-medium`}>{sub}</p>
      {progress !== undefined && (
        <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/[0.07]' : 'bg-slate-100'}`}>
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${safeProgress}%` }} />
        </div>
      )}
    </article>
  );
}

type QuickActionProps = ThemeProps & {
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
    <button type="button" onClick={onClick} className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors active:scale-[0.99] ${tone} ${dark ? 'bg-white/[0.02]' : 'bg-white shadow-sm'}`}>
      <span className={`p-2.5 rounded-xl shrink-0 ${danger ? 'bg-red-500/10' : dark ? 'bg-white/[0.05] text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>{icon}</span>
      <span className="min-w-0"><span className="block text-[13px] font-semibold truncate">{title}</span><span className={`block text-[11px] mt-0.5 truncate ${dark ? 'text-white/40' : 'text-slate-500'}`}>{sub}</span></span>
    </button>
  );
}

type ScreenButtonProps = ThemeProps & {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
};

export function ScreenBtn({ icon, label, onClick, dark, primary = false }: ScreenButtonProps) {
  const tone = primary
    ? dark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-emerald-600 text-white border-emerald-600'
    : dark ? 'text-white/45 border-transparent hover:bg-white/[0.05] hover:text-white' : 'text-slate-500 border-transparent hover:bg-slate-200';
  return (
    <button type="button" onClick={onClick} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border transition-colors active:scale-95 ${tone}`}>
      {icon}<span className="text-[9px] uppercase tracking-wider font-semibold">{label}</span>
    </button>
  );
}
