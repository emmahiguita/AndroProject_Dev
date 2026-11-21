// ============================================================================
// ARCHIVO: useStreamTracker.ts
// QUÉ HACE: Monitorea el estado activo de transmisiones de pantalla por dispositivo
//           y provee acciones para alternar (iniciar / detener) la proyección.
// CÓMO FUNCIONA: Consulta periódicamente el endpoint `/api/actions` (check_screen)
//           y actualiza el mapa de streams activos por serial.
// POR QUÉ: Desacoplar la lógica de polling y control de streaming de la vista AppShell.
// ============================================================================
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DeviceInfo, NavSection } from '@/features/types';

interface UseStreamTrackerProps {
  selectedSerial: string;
  devices: DeviceInfo[];
  onNavigate: (n: NavSection) => void;
  addLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function useStreamTracker({
  selectedSerial,
  devices,
  onNavigate,
  addLog,
}: UseStreamTrackerProps) {
  const [activeStreams, setActiveStreams] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!selectedSerial) return;
    let mounted = true;

    const checkStream = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const res = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check_screen', serial: selectedSerial }),
        });
        const data = await res.json();
        if (mounted && data.success) {
          setActiveStreams((prev) => ({ ...prev, [selectedSerial]: !!data.alive }));
        }
      } catch {}
    };

    checkStream();
    const interval = setInterval(checkStream, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [selectedSerial]);

  const toggleTransmit = useCallback(async () => {
    if (!selectedSerial) return;
    const isCurrentlyActive = !!activeStreams[selectedSerial];
    const dev = devices.find((d) => d.serial === selectedSerial);
    const devName = dev?.model || selectedSerial;

    if (isCurrentlyActive) {
      try {
        await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'stop_screen', serial: selectedSerial }),
        });
        setActiveStreams((prev) => ({ ...prev, [selectedSerial]: false }));
        addLog(`Transmisión scrcpy detenida: ${devName}`, 'info');
      } catch {
        addLog(`Error al detener transmisión de ${devName}`, 'error');
      }
    } else {
      onNavigate('projection');
      setActiveStreams((prev) => ({ ...prev, [selectedSerial]: true }));
      addLog(`Proyección 60 FPS WebCodecs activada: ${devName}`, 'success');
    }
  }, [selectedSerial, activeStreams, devices, onNavigate, addLog]);

  return {
    activeStreams,
    setActiveStreams,
    isTransmitting: !!activeStreams[selectedSerial],
    toggleTransmit,
  };
}
