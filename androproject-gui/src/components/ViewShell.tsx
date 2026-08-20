'use client';

import { useAppStore } from '@/stores';

interface ViewShellProps {
  navId: string;
  children: React.ReactNode;
  /** When true, the shell fills parent height instead of auto-sizing */
  fill?: boolean;
}

/**
 * Shared animation wrapper for all views.
 * Eliminates 7 copies of the same opacity/translate pattern.
 * Each view sets its navId; the shell handles active/inactive transitions.
 */
export function ViewShell({ navId, children, fill }: ViewShellProps) {
  const activeNav = useAppStore((s) => s.activeNav);
  const isActive = activeNav === navId;
  const fillClass = fill ? 'h-full' : '';
  const stateClass = isActive
    ? 'opacity-100 translate-y-0 relative z-0'
    : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none';

  return (
    <div className={`min-w-0 max-w-full overflow-x-hidden transition-all duration-200 ${fillClass} ${stateClass}`}>
      {children}
    </div>
  );
}
