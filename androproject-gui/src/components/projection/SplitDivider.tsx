// ── SplitDivider — draggable split handle ───────────────────
// SRP: renders the visual divider between two panels.
// Uses design tokens for consistent shadows and borders.

'use client';

import React from 'react';
import { GripVertical } from 'lucide-react';

interface SplitDividerProps {
  dark: boolean;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  ratio: number;
}

export const SplitDivider: React.FC<SplitDividerProps> = ({
  dark, isDragging, onPointerDown, onKeyDown, ratio,
}) => (
  <div
    className={`relative flex items-center justify-center shrink-0 cursor-col-resize group w-[6px] transition-colors ${
      isDragging
        ? dark ? 'bg-zinc-700/60' : 'bg-slate-300'
        : dark
          ? 'bg-zinc-900 hover:bg-zinc-800'
          : 'bg-slate-100 hover:bg-slate-200'
    }`}
    onPointerDown={onPointerDown}
    onKeyDown={onKeyDown}
    tabIndex={0}
    role="separator"
    aria-orientation="vertical"
    aria-valuenow={Math.round(ratio * 100)}
  >
    {/* Grip handle — visible on hover/drag */}
    <div className={`flex items-center justify-center rounded-md transition-all ${
      isDragging
        ? dark ? 'w-5 h-12 bg-zinc-700' : 'w-5 h-12 bg-slate-300'
        : 'w-1 h-6 group-hover:h-10 group-hover:bg-zinc-500/20 opacity-0 group-hover:opacity-100'
    }`}>
      <GripVertical size={10} className={dark ? 'text-zinc-300' : 'text-slate-600'} />
    </div>

    {/* Center dots — always visible as drop targets */}
    <div className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
      <span className={`w-1 h-1 rounded-full transition-colors ${
        isDragging
          ? dark ? 'bg-zinc-200' : 'bg-slate-700'
          : dark ? 'bg-zinc-700' : 'bg-slate-300'
      }`} />
      <span className={`w-1 h-1 rounded-full transition-colors ${
        isDragging
          ? dark ? 'bg-zinc-200' : 'bg-slate-700'
          : dark ? 'bg-zinc-700' : 'bg-slate-300'
      }`} />
      <span className={`w-1 h-1 rounded-full transition-colors ${
        isDragging
          ? dark ? 'bg-zinc-200' : 'bg-slate-700'
          : dark ? 'bg-zinc-700' : 'bg-slate-300'
      }`} />
    </div>
  </div>
);
