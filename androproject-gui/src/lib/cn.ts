/**
 * cn — tiny class-name joiner.
 * Filters falsy values so callers can write conditional classes inline:
 *   cn('btn', active && 'is-active', maybeUndefined)
 * Drop-in replacement for clsx; dependency-free on purpose.
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}