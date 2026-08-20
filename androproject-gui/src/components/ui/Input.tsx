'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Input — campo de formulario del design system.
 * - Label con `htmlFor` vinculado por id autogenerado (accesible).
 * - Estados: error (borde + texto + aria-invalid), helper, disabled.
 * - Token-based → dark/light automático; altura 40px consistente.
 * El placeholder nunca sustituye al label: el label es obligatorio.
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helper?: string;
  /** Ícono (lucide) a la izquierda del campo. */
  icon?: ReactNode;
  hideLabel?: boolean;
}

export function Input({
  label,
  error,
  helper,
  icon,
  hideLabel = false,
  id: idProp,
  className,
  disabled,
  required,
  ...rest
}: InputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  const describedBy = [error ? errorId : null, !error && helper ? helperId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={id}
        className={cn(
          'text-xs font-medium text-text-secondary',
          hideLabel && 'sr-only',
        )}
      >
        {label}
        {required && <span className="text-semantic-danger" aria-hidden="true"> *</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-tertiary" aria-hidden="true">
            {icon}
          </span>
        )}
        <input
          id={id}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-10 w-full rounded-md border bg-surface-base px-3 text-sm text-text-primary',
            'placeholder:text-text-tertiary',
            'transition-colors duration-150 ease-out',
            'disabled:opacity-50 disabled:pointer-events-none',
            icon ? 'pl-9' : null,
            error
              ? 'border-semantic-danger focus-visible:outline-semantic-danger'
              : 'border-border focus:border-border-accent',
            className,
          )}
          {...rest}
        />
      </div>
      {error ? (
        <p id={errorId} className="text-xs font-medium text-semantic-danger" role="alert">
          {error}
        </p>
      ) : helper ? (
        <p id={helperId} className="text-xs text-text-tertiary">
          {helper}
        </p>
      ) : null}
    </div>
  );
}