'use client';

import type { NavSection } from '@/features/types';



interface ViewShellProps {
  navId?: NavSection;
  children: React.ReactNode;
  /** When true, the shell fills parent height instead of auto-sizing */
  fill?: boolean;
}


/**
 * Shared animation wrapper for all views.
 * Eliminates 7 copies of the same opacity/translate pattern.
 * Each view sets its navId; the shell handles active/inactive transitions.
 */
export function ViewShell({ children, fill }: ViewShellProps) {
  const fillClass = fill ? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden' : '';
 
   return (
     <div className={`relative w-full min-w-0 max-w-full ${fillClass}`}>
       {children}
     </div>
   );
}

