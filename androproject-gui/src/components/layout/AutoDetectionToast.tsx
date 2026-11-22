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
import { Button } from '@/components/ui/Button';
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
    <div className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-lg border border-border-control bg-surface-card px-3 py-2.5 shadow-lg">
      <div className="min-w-0 flex-1 text-xs" role="status">
        <p className="font-bold text-text-primary">Dispositivo detectado</p>
        <p className="break-words text-text-secondary">
          {device.model} ({device.connectionType})
        </p>
      </div>
      <Button size="sm" onClick={onConfirm} icon={<MonitorPlay size={16} />}>Abrir proyección</Button>
      <Button variant="ghost" size="sm" className="px-2" onClick={onClose} aria-label="Cerrar notificación" title="Cerrar notificación">
        <X size={16} />
      </Button>
    </div>
  );
};
