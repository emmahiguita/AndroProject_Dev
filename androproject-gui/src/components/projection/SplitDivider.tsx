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
        ? 'bg-blue-500/20'
        : dark
          ? 'bg-white/[0.04] hover:bg-blue-500/15'
          : 'bg-slate-100 hover:bg-blue-50/50'
    }`}
    onPointerDown={onPointerDown}
    onKeyDown={onKeyDown}
    tabIndex={0}
    role="separator"
    aria-orientation="vertical"
    aria-valuenow={Math.round(ratio * 100)}
  >
    {/* Grip handle — visible on hover/drag */}
    <div className={`flex items-center justify-center rounded-lg transition-all ${
      isDragging
        ? 'w-5 h-12 bg-blue-500/25 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
        : 'w-1 h-6 group-hover:h-10 group-hover:bg-blue-500/20 opacity-0 group-hover:opacity-100'
    }`}>
      <GripVertical size={10} className={`transition-colors ${
        isDragging ? 'text-blue-400' : 'text-blue-400/60'
      }`} />
    </div>

    {/* Center dots — always visible as drop targets */}
    <div className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
      <span className={`w-1 h-1 rounded-full transition-colors ${
        isDragging
          ? 'bg-blue-400 shadow-[0_0_4px_rgba(59,130,246,0.5)]'
          : dark ? 'bg-white/10' : 'bg-slate-300'
      }`} />
      <span className={`w-1 h-1 rounded-full transition-colors ${
        isDragging
          ? 'bg-blue-400 shadow-[0_0_4px_rgba(59,130,246,0.5)]'
          : dark ? 'bg-white/10' : 'bg-slate-300'
      }`} />
      <span className={`w-1 h-1 rounded-full transition-colors ${
        isDragging
          ? 'bg-blue-400 shadow-[0_0_4px_rgba(59,130,246,0.5)]'
          : dark ? 'bg-white/10' : 'bg-slate-300'
      }`} />
    </div>

    {/* Drag shadow effect */}
    {isDragging && (
      <div className="absolute inset-0 bg-blue-500/5 pointer-events-none" />
    )}
  </div>
);
