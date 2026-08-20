// ── EmptyState — no device connected ────────────────────────
// SRP: renders the empty state when no device is connected.
// Uses design tokens for consistent shadows and borders.

'use client';

import React from 'react';
import { Smartphone, Wifi, Usb } from 'lucide-react';

interface EmptyStateProps {
  dark: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ dark }) => (
  <div className="flex flex-col items-center justify-center h-full text-center gap-6 px-4">
    {/* Animated phone icon */}
    <div className={`relative w-20 h-20 rounded-2xl flex items-center justify-center ${
      dark
        ? 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06]'
        : 'bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-sm'
    }`}>
      <Smartphone size={32} className={dark ? 'text-white/20' : 'text-slate-300'} />
      {/* Pulsing ring */}
      <div className={`absolute inset-0 rounded-2xl border-2 ${
        dark ? 'border-[#22c97d]/20' : 'border-emerald-300/40'
      } animate-ping opacity-30`} />
    </div>

    <div>
      <p className={`text-sm font-bold mb-1 ${dark ? 'text-white/60' : 'text-slate-500'}`}>
        Sin dispositivo conectado
      </p>
      <p className={`text-[10px] max-w-[240px] ${dark ? 'text-white/30' : 'text-slate-400'}`}>
        Conecta un dispositivo vía USB o Wi-Fi para ver la proyección en tiempo real
      </p>
    </div>

    {/* Connection hints */}
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5">
        <div className={`p-1.5 rounded-lg ${dark ? 'bg-white/5' : 'bg-slate-100'}`}>
          <Usb size={12} className={dark ? 'text-white/30' : 'text-slate-400'} />
        </div>
        <span className={`text-[9px] font-medium ${dark ? 'text-white/30' : 'text-slate-400'}`}>USB</span>
      </div>
      <div className={`w-px h-3 ${dark ? 'bg-white/10' : 'bg-slate-200'}`} />
      <div className="flex items-center gap-1.5">
        <div className={`p-1.5 rounded-lg ${dark ? 'bg-white/5' : 'bg-slate-100'}`}>
          <Wifi size={12} className={dark ? 'text-white/30' : 'text-slate-400'} />
        </div>
        <span className={`text-[9px] font-medium ${dark ? 'text-white/30' : 'text-slate-400'}`}>Wi-Fi</span>
      </div>
    </div>
  </div>
);
