'use client';

import { useAppStore } from '@/stores';
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
  const fillClass = fill ? 'h-full flex-1 flex flex-col min-h-0' : '';
 
   return (
     <div className={`w-full min-w-0 max-w-full overflow-hidden transition-all duration-200 opacity-100 translate-y-0 relative z-0 ${fillClass}`}>
       {children}
     </div>
   );
}

