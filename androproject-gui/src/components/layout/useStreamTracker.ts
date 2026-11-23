// ============================================================================
// ARCHIVO: useStreamTracker.ts
// QUÉ HACE: Monitorea el estado activo de transmisiones de pantalla por dispositivo
//           y provee acciones para alternar (iniciar / detener) la proyección.
// CÓMO FUNCIONA: Consulta periódicamente el endpoint `/api/actions` (check_screen)
//           y actualiza el mapa de streams activos por serial.
// POR QUÉ: Desacoplar la lógica de polling y control de streaming de la vista AppShell.
// ============================================================================
'use client';
import { apiUrl } from '@/lib/api-url';

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
        const res = await fetch(apiUrl('/api/actions'), {
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

  // Abrir la vista prepara la proyección; solo el servidor confirma si está activa.
  const toggleTransmit = useCallback(async () => {
    if (!selectedSerial) return;
    const isCurrentlyActive = !!activeStreams[selectedSerial];
    const dev = devices.find((d) => d.serial === selectedSerial);
    const devName = dev?.model || selectedSerial;

    if (isCurrentlyActive) {
      try {
        const response = await fetch(apiUrl('/api/actions'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'stop_screen', serial: selectedSerial }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          addLog(result.error || `No se pudo detener la transmisión de ${devName}`, 'error');
          return;
        }
        setActiveStreams((prev) => ({ ...prev, [selectedSerial]: false }));
        addLog(`Transmisión scrcpy detenida: ${devName}`, 'info');
      } catch {
        addLog(`Error al detener transmisión de ${devName}`, 'error');
      }
    } else {
      onNavigate('projection');
      addLog(`Vista de proyección abierta: ${devName}`, 'info');
    }
  }, [selectedSerial, activeStreams, devices, onNavigate, addLog]);

  return {
    activeStreams,
    setActiveStreams,
    isTransmitting: !!activeStreams[selectedSerial],
    toggleTransmit,
  };
}
