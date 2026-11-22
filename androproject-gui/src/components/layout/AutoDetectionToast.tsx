// ============================================================================
// ARCHIVO: AutoDetectionToast.tsx
// QUÉ HACE: Banner flotante que alerta cuando un nuevo dispositivo se conecta
//           por USB o Wi-Fi y ofrece proyectarlo inmediatamente a 60 FPS.
// CÓMO FUNCIONA: Muestra modelo y conexión con tipografía de alto contraste.
// POR QUÉ: Eliminar textos tenues (`text-white/50`, `text-white/40`) (< 200L).
// ============================================================================
'use client';

import React from 'react';
import { MonitorPlay, X } from 'lucide-react';
import type { DeviceInfo } from '@/features/types';

interface AutoDetectionToastProps {
  device: DeviceInfo | null;
  onConfirm: () => void;
  onClose: () => void;
}

export const AutoDetectionToast: React.FC<AutoDetectionToastProps> = ({
  device,
  onConfirm,
  onClose,
}) => {
  if (!device) return null;

  return (
    <div className="fixed bottom-3 right-3 sm:absolute sm:top-14 sm:bottom-auto sm:right-4 z-40 flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 max-w-[calc(100vw-24px)]">
      <div className="w-2.5 h-2.5 rounded-full bg-zinc-100 shrink-0" />
      <div className="text-xs">
        <p className="font-bold text-zinc-100">Dispositivo detectado</p>
        <p className="text-[11px] text-zinc-300">
          {device.model} ({device.connectionType})
        </p>
      </div>
      <button
        type="button"
        onClick={onConfirm}
        className="px-3 py-1 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold transition-all flex items-center gap-1 shadow-sm shrink-0 cursor-pointer"
      >
        <MonitorPlay size={12} />
        <span>Transmitir Ahora (60 FPS)</span>
      </button>
      <button
        type="button"
        onClick={onClose}
        className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
        title="Cerrar notificación"
      >
        <X size={13} />
      </button>
    </div>
  );
};
