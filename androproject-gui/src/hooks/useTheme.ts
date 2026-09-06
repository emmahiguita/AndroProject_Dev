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
    bg: dark ? 'bg-surface-root' : 'bg-surface-root',
    panel: dark ? 'bg-surface-raised' : 'bg-surface-raised',
    border: dark ? 'border-border-subtle' : 'border-border-subtle',
    text: dark ? 'text-text-primary' : 'text-text-primary',
    textMuted: dark ? 'text-text-secondary' : 'text-text-secondary',
    textSub: dark ? 'text-text-tertiary' : 'text-text-tertiary',
    hover: dark ? 'hover:bg-white/[0.05]' : 'hover:bg-black/[0.04]',
    cardInner: dark ? 'bg-surface-base' : 'bg-surface-base',
    dashedBorder: dark ? 'border-border-strong' : 'border-border-strong',
    accent: dark ? 'text-text-primary' : 'text-text-primary',
    accentBg: dark ? 'bg-white/10' : 'bg-black/5',
    accentBorder: dark ? 'border-border-accent' : 'border-border-accent',
    accentHover: dark ? 'hover:bg-white/15' : 'hover:bg-black/10',
  }), [dark]);

  return { t, dark };
}
