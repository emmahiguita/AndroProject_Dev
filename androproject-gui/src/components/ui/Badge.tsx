// ============================================================================
// ARCHIVO: Badge.tsx
// QUÉ HACE: Etiqueta de estado sobria y de alto contraste (modo claro y oscuro).
// CÓMO FUNCIONA: Usa tonos neutros legibles de `tokens.css` sin colores neón.
// POR QUÉ: Eliminar textos e insignias coloridas poco legibles (< 200 líneas).
// ============================================================================

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

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
  neutral: 'bg-surface-raised text-text-primary border-border',
  brand: 'bg-surface-raised text-text-primary border-border',
  success: 'bg-surface-raised text-text-primary border-border',
  warning: 'bg-surface-raised text-text-primary border-border',
  danger: 'bg-surface-raised text-text-primary border-border font-semibold',
  info: 'bg-surface-raised text-text-primary border-border',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
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
        'inline-flex items-center rounded-md border font-medium',
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
