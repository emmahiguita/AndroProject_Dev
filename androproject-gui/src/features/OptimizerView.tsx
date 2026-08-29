'use client';

import React, { useState } from 'react';
import { Zap, Cpu, HardDrive, RefreshCw, CheckCircle2, Sparkles } from 'lucide-react';
import { ViewShell } from '../components/ViewShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
        // No fabricar éxito cuando el backend falla
        setOptimizationComplete(false);
        addLog(`✗ Error al optimizar: ${data.error || 'HTTP ' + res.status}`, 'error');
        return;
      }

      // freedMB opcional: si el backend no lo reporta, no inventar un número
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
      addLog(`✗ Error de red al optimizar: ${msg}`, 'error');
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <ViewShell navId="optimizer">
      <div className="max-w-4xl mx-auto space-y-2.5">
        {/* Banner */}
        <Card padding="md" className="relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-bold">Acelerador de Sistema y Memoria RAM</h2>
              <p className="text-[10px] text-text-secondary max-w-lg">
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

        {/* Status */}
        {isOptimizing && (
          <Card padding="sm" className="flex items-center gap-2">
            <RefreshCw size={14} className="text-brand-light animate-spin shrink-0" />
            <p className="text-[10px] font-medium text-text-primary">
              Ejecutando en {device?.serial || 'dispositivo'}...
            </p>
          </Card>
        )}
        {optimizationComplete && (
          <Card padding="sm" className="border-border-accent bg-brand/5">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={24} className="text-brand-light shrink-0" />
              <div>
                <h3 className="text-[11px] font-bold text-text-primary">¡Optimizado con éxito!</h3>
                <p className="text-[10px] text-text-secondary mt-0.5">
                  {freedMemoryMB !== null ? (
                    <>Liberados <strong className="text-brand-light font-mono">{freedMemoryMB} MB</strong> de RAM.</>
                  ) : (
                    'Procesos detenidos y caché liberada.'
                  )}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Device facts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Card padding="sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-[9px] font-semibold uppercase tracking-wider">Memoria RAM</span>
              <Cpu size={14} className="text-brand-light" />
            </div>
            <p className="text-base font-bold font-mono text-text-primary mt-1">
              {device?.ram || '--'}
            </p>
            <p className="text-[10px] text-text-secondary">
              {device?.ramUsagePercent != null
                ? `${device.ramUsagePercent}% en uso`
                : device ? 'RAM total' : 'No detectado'}
            </p>
          </Card>

          <Card padding="sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-[9px] font-semibold uppercase tracking-wider">Almacenamiento</span>
              <HardDrive size={14} className="text-sky-400" />
            </div>
            <p className="text-base font-bold font-mono text-text-primary mt-1">
              {device?.storage || '--'}
            </p>
            <p className="text-[10px] text-text-secondary">
              {device?.storageFreeGB != null
                ? `${device.storageFreeGB} GB libres`
                : device ? 'Capacidad total' : '--'}
            </p>
          </Card>

          {/* FIX: reemplazado componente muerto por CPU % real */}
          <Card padding="sm">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-[9px] font-semibold uppercase tracking-wider">CPU</span>
              <RefreshCw size={14} className="text-amber-400" />
            </div>
            <p className="text-base font-bold font-mono text-text-primary mt-1">
              {device?.cpuUsagePercent != null ? `${device.cpuUsagePercent}%` : '--'}
            </p>
            <p className="text-[10px] text-text-secondary">
              {device ? 'Uso de procesador' : '--'}
            </p>
          </Card>
        </div>

        <p className="text-[9px] text-text-tertiary flex items-center gap-1">
          <Sparkles size={10} /> Lectura y optimización en tiempo real mediante comandos ADB nativos.
        </p>

      </div>
    </ViewShell>
  );
};