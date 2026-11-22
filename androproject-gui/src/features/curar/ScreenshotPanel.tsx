// ============================================================================
// ARCHIVO: ScreenshotPanel.tsx
// QUÉ HACE: Subpanel de Seguridad para diagnosticar/reparar bloqueos de captura
//           del sistema (`diagnose_screenshot`: FLAG_SECURE, gestos, políticas)
//           y preparar apps con LSPatch (`startPatching`) en perfil o directo.
// CÓMO FUNCIONA: Conecta el endpoint `diagnose_screenshot` de `/api/actions`
//           y ofrece selector rápido de paquetes instalados.
// POR QUÉ: Inyectar lógica completa al módulo de capturas sin código muerto (<200L).
// ============================================================================
'use client';

import React, { useState } from 'react';
import { Shield, AlertTriangle, Wrench, CheckCircle2, RefreshCw, Camera } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { useActions } from '@/hooks/useActions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

interface ScreenshotDiagResult {
  repaired: boolean;
  findings: string[];
  fixes: string[];
  captureTestOk: boolean;
  message: string;
}

export const ScreenshotPanel: React.FC<{ serial?: string | null }> = ({ serial: propSerial }) => {
  const { dark } = useTheme();
  const patchPackage = useAppStore((s) => s.patchPackage);
  const setPatchPackage = useAppStore((s) => s.setPatchPackage);
  const isPatching = useAppStore((s) => s.isPatching);
  const isCloneMode = useAppStore((s) => s.isCloneMode);
  const setIsCloneMode = useAppStore((s) => s.setIsCloneMode);
  const patchLogs = useAppStore((s) => s.patchLogs);
  const device = useAppStore((s) => s.device);
  const activeSerial = useAppStore((s) => s.activeSerial);
  const appsList = useAppStore((s) => s.appsList);
  const addLog = useAppStore((s) => s.addLog);
  const { startPatching, fetchApps } = useActions();

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
      const res = await fetch('/api/actions', {
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
    addLog(`Auditando y reparando subsistema de capturas en ${targetSerial}...`);
    try {
      const res = await fetch('/api/actions', {
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

  const handlePatch = async () => {
    const { setIsPatching, setPatchLogs } = useAppStore.getState();
    await startPatching(patchPackage, setIsPatching, setPatchLogs);
  };

  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';
  const userApps = appsList.filter((a) => !a.isSystem);

  return (
    <div className="space-y-3.5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
              <Wrench size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold">Diagnóstico y Reparación de Capturas del Sistema</h2>
              <p className={`text-xs ${mutedCls} mt-0.5`}>Detecta `FLAG_SECURE`, `disable_screen_shot=1`, gestos desactivados y políticas MDM, reparándolos por ADB.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" icon={<Camera size={13} />} disabled={!isConnected || capturing} loading={capturing} onClick={handleCaptureNow}>
              {capturing ? 'Capturando...' : 'Tomar Captura HD'}
            </Button>
            <Button size="sm" variant="secondary" icon={<RefreshCw size={13} className={diagRunning ? 'animate-spin' : ''} />} disabled={!isConnected || diagRunning} onClick={handleRunScreenshotDiag}>
              {diagRunning ? 'Diagnosticando...' : 'Diagnosticar y Reparar'}
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

      <Card>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">Curador LSPatch por Aplicación (DisableFlagSecure)</h3>
              <p className={`text-xs ${mutedCls}`}>Inyecta el módulo de compatibilidad de capturas en un APK o App Bundle instalado.</p>
            </div>
            {appsList.length === 0 && <Button size="sm" variant="secondary" onClick={fetchApps} disabled={!isConnected}>Cargar lista de apps</Button>}
          </div>

          {userApps.length > 0 && (
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${mutedCls}`}>Seleccionar aplicación instalada ({userApps.length})</label>
              <select value={patchPackage} onChange={(e) => setPatchPackage(e.target.value)} className={`w-full rounded-lg border px-3 py-2 text-xs font-mono ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}>
                <option value="">-- Seleccionar paquete del dispositivo --</option>
                {userApps.map((a) => <option key={a.packageName} value={a.packageName}>{a.name} ({a.packageName})</option>)}
              </select>
            </div>
          )}

          <Input label="Nombre del paquete objetivo" placeholder="ej. com.badoo.mobile" value={patchPackage} onChange={(e) => setPatchPackage(e.target.value)} icon={<Shield size={14} />} />

          <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            isCloneMode ? (dark ? 'bg-zinc-900 border-zinc-700' : 'bg-slate-100 border-slate-300') : (dark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200')
          }`}>
            <input type="checkbox" checked={isCloneMode} onChange={(e) => setIsCloneMode(e.target.checked)} className="w-4 h-4 rounded border-zinc-500 cursor-pointer accent-zinc-600" />
            <div>
              <span className="text-xs font-bold">Instalar en perfil de trabajo aislado (Modo Clon)</span>
              <p className={`text-[11px] ${mutedCls} mt-0.5`}>Conserva la aplicación original intacta en el usuario principal.</p>
            </div>
          </label>
          {!isCloneMode && (
            <p className={`text-xs ${mutedCls} flex items-center gap-1.5`}><AlertTriangle size={13} className="shrink-0" /><span><strong>Reemplazo directo:</strong> Se extraerá, parchará, firmará y reinstalará sobre la app original.</span></p>
          )}

          <Button fullWidth size="md" icon={<Shield size={15} className={isPatching ? 'animate-pulse' : ''} />} disabled={!patchPackage || isPatching || !isConnected} onClick={handlePatch}>
            {isPatching ? 'Extrayendo y parcheando APK con LSPatch...' : 'Preparar y Curar Aplicación'}
          </Button>
        </div>
      </Card>

      {patchLogs && (
        <Card>
          <p className={`text-[11px] ${mutedCls} uppercase tracking-wider font-bold mb-2`}>Registro del proceso LSPatch</p>
          <div className={`font-mono text-xs h-48 overflow-y-auto whitespace-pre-wrap custom-scrollbar ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>{patchLogs}</div>
        </Card>
      )}
    </div>
  );
};
