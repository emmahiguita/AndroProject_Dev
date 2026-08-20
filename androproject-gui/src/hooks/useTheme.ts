'use client';

import { useMemo } from 'react';
import { useAppTheme } from '@/components/ThemeProvider';

type ThemeColors = {
  bg: string;
  panel: string;
  border: string;
  text: string;
  textMuted: string;
  textSub: string;
  hover: string;
  cardInner: string;
  dashedBorder: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  accentHover: string;
};

/**
 * Theme hook — derives Tailwind classes from ThemeProvider context.
 * All feature views use this; no prop drilling needed.
 */
export function useTheme(): { t: ThemeColors; dark: boolean } {
  const { isDark: dark } = useAppTheme();

  const t = useMemo<ThemeColors>(() => ({
    bg: dark ? 'bg-[#0b0e17]' : 'bg-slate-50',
    panel: dark ? 'bg-[#111622]' : 'bg-white',
    border: dark ? 'border-white/5' : 'border-slate-200',
    text: dark ? 'text-white' : 'text-slate-900',
    textMuted: dark ? 'text-white/45' : 'text-slate-500',
    textSub: dark ? 'text-white/28' : 'text-slate-400',
    hover: dark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-100',
    cardInner: dark ? 'bg-white/[0.03]' : 'bg-slate-100',
    dashedBorder: dark ? 'border-white/10' : 'border-slate-300',
    accent: dark ? 'text-[#22c97d]' : 'text-emerald-600',
    accentBg: dark ? 'bg-[#1bae6e]/15' : 'bg-emerald-100',
    accentBorder: dark ? 'border-[#1bae6e]/30' : 'border-emerald-300',
    accentHover: dark ? 'hover:bg-[#1bae6e]/20' : 'hover:bg-emerald-200',
  }), [dark]);

  return { t, dark };
}
