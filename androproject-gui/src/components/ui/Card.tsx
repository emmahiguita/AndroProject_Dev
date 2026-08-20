import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Card — contenedor elevado del design system.
 * Token-based (surface-raised + bordes CSS vars) → dark/light automático.
 * `interactive` añade feedback hover (borde accent) sin sombra desmedida.
 *
 * Uso con secciones: `<Card title="…" action={…}>` cubre el patrón
 * "título + acción a la derecha" usado en todas las vistas.
 */
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Título de sección (caps pequeño, consistente con las vistas). */
  heading?: ReactNode;
  /** Slot derecho del encabezado (botón de acción). */
  action?: ReactNode;
  padding?: CardPadding;
  interactive?: boolean;
}

const paddingClasses: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export function Card({
  heading,
  action,
  padding = 'md',
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-surface-raised shadow-sm',
        interactive && 'transition-colors duration-200 ease-out hover:border-border-accent',
        paddingClasses[padding],
        className,
      )}
      {...rest}
    >
{(heading || action) && (
        <header
          className={cn(
            'mb-3 flex items-center justify-between gap-3',
            padding === 'lg' && 'mb-4',
          )}
        >
          {typeof heading === 'string' ? (
            <h3 className="text-2xs font-bold uppercase tracking-widest text-text-secondary">
              {heading}
            </h3>
          ) : (
            heading
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}