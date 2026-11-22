// ============================================================================
// ARCHIVO: OptimizerView.tsx
// QUÉ HACE: Vista del Optimizador de Sistema, liberación de RAM/caché por ADB
//           y panel de perfiles Turbo (Modo Desarrollador, GPU y refresco).
// CÓMO FUNCIONA: Despacha `optimize_ram` a `/api/actions` y delega perfiles
//           avanzados a `TurboBoostPanel` con iconografía monocroma legible.
// POR QUÉ: Eliminar iconos coloridos (`text-brand-light`) y textos diminutos (< 200L).
// ============================================================================
'use client';

import React, { useState } from 'react';
import { Zap, Cpu, HardDrive, RefreshCw, CheckCircle2, Sparkles } from 'lucide-react';
import { ViewShell } from '../components/ViewShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TurboBoostPanel } from './optimizer/TurboBoostPanel';
import { DeviceInfo } from './types';

interface OptimizerViewProps {
  device: DeviceInfo | null;
  addLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const OptimizerView: React.FC<OptimizerViewProps> = ({ device, addLog }) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationComplete, setOptimizationComplete] = useState(false);
  const [freedMemoryMB, setFreedMemoryMB] = useState<number | null>(null);

  const handleRunOptimization = async () => {
    if (!device) {
      addLog('No hay ningún dispositivo seleccionado para optimizar.', 'error');
      return;
    }

    setIsOptimizing(true);
    setOptimizationComplete(false);
    addLog(`Iniciando optimización del sistema en ${device.serial}...`, 'info');

    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'optimize_ram',
          serial: device.serial,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setOptimizationComplete(false);
        addLog(`Error al optimizar: ${data.error || 'HTTP ' + res.status}`, 'error');
        return;
      }

      const freed = typeof data.freedMB === 'number' ? data.freedMB : null;
      setFreedMemoryMB(freed);
      setOptimizationComplete(true);
      addLog(
        freed !== null
          ? `Optimización completada. Se liberaron ${freed} MB de memoria RAM.`
          : 'Optimización completada.',
        'success',
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOptimizationComplete(false);
      addLog(`Error de red al optimizar: ${msg}`, 'error');
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <ViewShell navId="optimizer">
      <div className="max-w-4xl mx-auto space-y-2.5">
        <Card padding="md" className="relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-bold">Acelerador de Sistema y Memoria RAM</h2>
              <p className="text-xs text-text-secondary max-w-lg">
                Cierra procesos en segundo plano, borra cachés y optimiza el rendimiento.
              </p>
            </div>

            <Button
              size="sm"
              icon={<Zap size={14} className={isOptimizing ? 'animate-bounce' : ''} />}
              onClick={handleRunOptimization}
              disabled={isOptimizing}
              className="shrink-0"
            >
              {isOptimizing ? 'Optimizando...' : 'Acelerar'}
            </Button>
          </div>
        </Card>

        {isOptimizing && (
          <Card padding="sm" className="flex items-center gap-2">
            <RefreshCw size={14} className="text-text-secondary animate-spin shrink-0" />
            <p className="text-xs font-medium text-text-primary">
              Ejecutando en {device?.serial || 'dispositivo'}...
            </p>
          </Card>
        )}
        {optimizationComplete && (
          <Card padding="sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-text-primary shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-text-primary">¡Optimizado con éxito!</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {freedMemoryMB !== null ? (
                    <>Liberados <strong className="text-text-primary font-mono">{freedMemoryMB} MB</strong> de RAM.</>
                  ) : (
                    'Procesos detenidos y caché liberada.'
                  )}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Card padding="sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Memoria RAM</span>
              <Cpu size={14} className="text-text-secondary" />
            </div>
            <p className="text-base font-bold font-mono text-text-primary mt-1">
              {device?.ram || '--'}
            </p>
            <p className="text-xs text-text-secondary">
              {device?.ramUsagePercent != null
                ? `${device.ramUsagePercent}% en uso`
                : device ? 'RAM total' : 'No detectado'}
            </p>
          </Card>

          <Card padding="sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Almacenamiento</span>
              <HardDrive size={14} className="text-text-secondary" />
            </div>
            <p className="text-base font-bold font-mono text-text-primary mt-1">
              {device?.storage || '--'}
            </p>
            <p className="text-xs text-text-secondary">
              {device?.storageFreeGB != null
                ? `${device.storageFreeGB} GB libres`
                : device ? 'Capacidad total' : '--'}
            </p>
          </Card>

          <Card padding="sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-[11px] font-semibold uppercase tracking-wider">CPU</span>
              <RefreshCw size={14} className="text-text-secondary" />
            </div>
            <p className="text-base font-bold font-mono text-text-primary mt-1">
              {device?.cpuUsagePercent != null ? `${device.cpuUsagePercent}%` : '--'}
            </p>
            <p className="text-xs text-text-secondary">
              {device ? 'Uso de procesador' : '--'}
            </p>
          </Card>
        </div>

        <TurboBoostPanel device={device} addLog={addLog} />

        <p className="text-[11px] text-text-secondary flex items-center gap-1">
          <Sparkles size={11} /> Lectura y optimización en tiempo real mediante comandos ADB nativos.
        </p>
      </div>
    </ViewShell>
  );
};
