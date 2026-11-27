// Consulta el diagnóstico y guarda capturas PNG con el dispositivo seleccionado.
'use client';
import { apiUrl } from '@/lib/api-url';

import React, { useState } from 'react';
import { AlertTriangle, Wrench, CheckCircle2, RefreshCw, Camera } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface ScreenshotDiagResult {
  repaired: boolean;
  findings: string[];
  fixes: string[];
  captureTestOk: boolean;
  message: string;
}

export const ScreenshotPanel: React.FC<{ serial?: string | null }> = ({ serial: propSerial }) => {
  const { dark } = useTheme();
  const device = useAppStore((s) => s.device);
  const activeSerial = useAppStore((s) => s.activeSerial);
  const addLog = useAppStore((s) => s.addLog);

  const targetSerial = propSerial || activeSerial || device?.serial || null;
  const isConnected = Boolean(targetSerial && targetSerial !== 'Hardware Level');
  const [diagRunning, setDiagRunning] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [lastCaptureMsg, setLastCaptureMsg] = useState<string | null>(null);
  const [diagResult, setDiagResult] = useState<ScreenshotDiagResult | null>(null);

  /** Dispara la captura PNG real en el dispositivo vía `/api/actions` (`screenshot`). */
  const handleCaptureNow = async () => {
    if (!isConnected) return;
    setCapturing(true);
    setLastCaptureMsg(null);
    try {
      const res = await fetch(apiUrl('/api/actions'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'screenshot', serial: targetSerial }),
      });
      const data = await res.json();
      const msg = data.success ? `${data.message} (${Math.round((data.size || 0) / 1024)} KB)` : (data.error || 'No se pudo capturar la pantalla');
      setLastCaptureMsg(msg);
      addLog(msg);
    } catch { setLastCaptureMsg('Error de red al capturar pantalla'); }
    finally { setCapturing(false); }
  };

  const handleRunScreenshotDiag = async () => {
    if (!isConnected) return;
    setDiagRunning(true);
    setDiagResult(null);
    addLog(`Comprobando captura ADB en ${targetSerial}...`);
    try {
      const res = await fetch(apiUrl('/api/actions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'diagnose_screenshot', serial: targetSerial }),
      });
      const data = await res.json();
      if (data.success) {
        setDiagResult({
          repaired: Boolean(data.repaired),
          findings: data.findings || [],
          fixes: data.fixes || [],
          captureTestOk: Boolean(data.captureTestOk),
          message: data.message || 'Diagnóstico finalizado',
        });
        addLog(data.message || 'Diagnóstico de capturas completado.');
      } else addLog(`Error en diagnóstico de capturas: ${data.error || 'Fallo ADB'}`);
    } catch { addLog('Error de red al diagnosticar capturas'); }
    finally { setDiagRunning(false); }
  };

  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';

  return (
    <div className="space-y-3.5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
              <Wrench size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold">Diagnóstico de captura ADB</h2>
              <p className={`text-xs ${mutedCls} mt-0.5`}>Comprueba si el dispositivo devuelve una imagen PNG a través de ADB.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" icon={<Camera size={13} />} disabled={!isConnected || capturing} loading={capturing} onClick={handleCaptureNow}>
              {capturing ? 'Capturando...' : 'Tomar Captura HD'}
            </Button>
            <Button size="sm" variant="secondary" icon={<RefreshCw size={13} className={diagRunning ? 'animate-spin' : ''} />} disabled={!isConnected || diagRunning} onClick={handleRunScreenshotDiag}>
              {diagRunning ? 'Diagnosticando...' : 'Comprobar captura'}
            </Button>
          </div>
        </div>

        {lastCaptureMsg && (
          <div className={`mt-2.5 px-3 py-2 rounded-lg border text-xs font-mono ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
            {lastCaptureMsg}
          </div>
        )}

        {diagResult && (
          <div className={`mt-3 p-3 rounded-xl border text-xs space-y-1.5 ${dark ? 'bg-zinc-900/70 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2 font-bold">
              {diagResult.captureTestOk ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              <span>{diagResult.message}</span>
            </div>
            {diagResult.findings.length > 0 && <p className={`font-mono text-[11px] ${mutedCls}`}>Hallazgos: {diagResult.findings.join(' · ')}</p>}
            {diagResult.fixes.length > 0 && <p className="font-mono text-[11px]">Reparaciones aplicadas: {diagResult.fixes.join(' · ')}</p>}
          </div>
        )}
      </Card>

    </div>
  );
};
