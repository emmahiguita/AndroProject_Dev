import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Badge — etiqueta de estado semántica.
 * Token-based: los tonos usan la paleta semantic de tokens.css
 * (auto dark/light, sin prop `dark`).
 */
export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  icon?: ReactNode;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-raised text-text-secondary border-border',
  brand: 'bg-brand/10 text-brand-light border-brand/25',
  success: 'bg-semantic-success/10 text-emerald-400 border-semantic-success/25',
  warning: 'bg-semantic-warning/10 text-amber-400 border-semantic-warning/25',
  danger: 'bg-semantic-danger/10 text-red-400 border-semantic-danger/25',
  info: 'bg-semantic-info/10 text-sky-400 border-semantic-info/25',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

export function Badge({
  tone = 'neutral',
  size = 'sm',
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}