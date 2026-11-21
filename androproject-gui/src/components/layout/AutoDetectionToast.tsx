// ============================================================================
// ARCHIVO: AutoDetectionToast.tsx
// QUÉ HACE: Banner flotante que alerta cuando un nuevo dispositivo se conecta
//           por USB o Wi-Fi y ofrece proyectarlo inmediatamente a 60 FPS.
// CÓMO FUNCIONA: Muestra modelo y conexión con un botón de acción rápida.
// POR QUÉ: Brindar retroalimentación instantánea sin forzar al usuario a buscar en menús.
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
    <div className="fixed bottom-3 right-3 sm:absolute sm:top-14 sm:bottom-auto sm:right-4 z-40 flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-zinc-900/95 border border-zinc-700 text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 max-w-[calc(100vw-24px)]">
      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      <div className="text-xs">
        <p className="font-bold text-white">Dispositivo detectado</p>
        <p className="text-[10px] text-white/50">
          {device.model} ({device.connectionType})
        </p>
      </div>
      <button
        onClick={onConfirm}
        className="px-3 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-[11px] font-bold transition-all flex items-center gap-1 shadow-sm shrink-0"
      >
        <MonitorPlay size={12} />
        <span>Transmitir Ahora (60 FPS)</span>
      </button>
      <button
        onClick={onClose}
        className="p-1 text-white/40 hover:text-white transition-colors"
        title="Cerrar notificación"
      >
        <X size={13} />
      </button>
    </div>
  );
};
