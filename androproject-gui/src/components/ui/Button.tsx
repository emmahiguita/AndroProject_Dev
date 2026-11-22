'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Button — primitivo del design system.
 * Token-based: colores vía CSS vars (dark/light automático, sin prop `dark`).
 *
 * Variantes:
 *   primary   — sólido brand (acción principal, CTA)
 *   secondary — superficie elevada (acción alternativa)
 *   outline   — borde (acción de menor peso)
 *   ghost     — sin fondo (acción contextual/inline)
 *   danger    — sólido rojo (acciones destructivas)
 *
 * Tamaños:
 *   sm — 32px · md — 40px · lg — 48px (guía de altura)
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ícono (lucide) mostrado a la izquierda del contenido. */
  icon?: ReactNode;
  /** Reemplaza el contenido mientras carga y bloquea la interacción. */
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-transparent bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hov)] shadow-xs',
  secondary:
    'bg-surface-raised text-text-primary border border-border-control hover:bg-surface-overlay',
  outline:
    'bg-transparent text-text-primary border border-border-control hover:bg-surface-overlay',
  ghost:
    'bg-transparent text-text-secondary border border-transparent hover:bg-surface-overlay hover:text-text-primary',
  danger:
    'border border-transparent bg-[var(--btn-danger-bg)] text-white hover:bg-[var(--btn-danger-hov)] shadow-xs',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded-md font-semibold',
        'transition-colors duration-150 ease-out',
        'disabled:opacity-65',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 size={size === 'lg' ? 20 : 16} className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}
