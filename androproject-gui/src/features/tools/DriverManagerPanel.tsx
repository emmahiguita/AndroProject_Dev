// ============================================================================
// ARCHIVO: DriverManagerPanel.tsx
// QUÉ HACE: Panel de Windows DriverManager en Herramientas (diagnóstico USB
//           PnPUtil, detección de errores CM_PROB, verificación `.cat`,
//           copia de Hardware/Instance IDs e instalación segura de `.inf` OEM).
// CÓMO FUNCIONA: Consulta `/api/drivers` automáticamente al montar y despacha
//           `verify_cat` o `install_inf` con estética neutra de alto contraste.
// POR QUÉ: Inyectar diagnóstico USB completo sin código huérfano (< 200L, SRP).
// ============================================================================
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Usb, ShieldCheck, AlertTriangle, RefreshCw, Download, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks/useTheme';
import type { DriverScanReport } from '@/lib/services/driver-manager';

interface DriverManagerPanelProps {
  onLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const DriverManagerPanel: React.FC<DriverManagerPanelProps> = ({ onLog }) => {
  const { dark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DriverScanReport | null>(null);
  const [driverPath, setDriverPath] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scanDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/drivers');
      const d = await r.json();
      if (d.success) {
        setReport({
          mobileUsb: d.mobileUsb || [],
          mobileProblems: d.mobileProblems || [],
          otherProblemsCount: d.otherProblemsCount || 0,
          adbDevices: d.adbDevices || [],
          fastbootDevices: d.fastbootDevices || [],
        });
      }
    } catch {
      setStatusMsg({ text: 'No se pudo consultar PnPUtil (/api/drivers)', ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(scanDrivers); }, [scanDrivers]);

  const runDriverAction = async (action: 'verify_cat' | 'install_inf') => {
    if (!driverPath.trim()) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const r = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, filePath: driverPath.trim() }),
      });
      const d = await r.json();
      const msg = d.message || d.error || 'Completado';
      const ok = Boolean(d.success);
      setStatusMsg({ text: msg, ok });
      onLog?.(msg, ok ? 'success' : 'error');
      if (action === 'install_inf' && ok) scanDrivers();
    } catch {
      setStatusMsg({ text: 'Error comunicando con /api/drivers', ok: false });
      onLog?.('Error comunicando con /api/drivers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const cardCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900 shadow-sm';
  const rowCls = dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800';
  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';

  return (
    <div className={`rounded-xl border p-3.5 space-y-3 ${cardCls}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            <Usb size={14} />
          </div>
          <div>
            <h2 className="text-xs font-bold">DriverManager USB Windows (PnPUtil)</h2>
            <p className={`text-[11px] ${mutedCls}`}>Diagnostica VID/PID, errores USB, firma `.cat` e instala `.inf` OEM sin romper MTP/ADB.</p>
          </div>
        </div>
        <Button size="sm" variant="secondary" icon={<RefreshCw size={12} className={loading ? 'animate-spin' : ''} />} onClick={scanDrivers} disabled={loading}>
          Escanear USB
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <div className="flex-1">
          <Input
            label="Ruta paquete OEM (.cat para verificar firma o .inf para instalar)"
            placeholder="C:\Drivers\OEM\android_winusb.inf"
            value={driverPath}
            onChange={(e) => setDriverPath(e.target.value)}
          />
        </div>
        <Button size="sm" variant="secondary" icon={<ShieldCheck size={12} />} onClick={() => runDriverAction('verify_cat')} disabled={loading || !driverPath.trim()}>
          Verificar .cat
        </Button>
        <Button size="sm" icon={<Download size={12} />} onClick={() => runDriverAction('install_inf')} disabled={loading || !driverPath.trim()}>
          Instalar .inf
        </Button>
      </div>

      {statusMsg && (
        <div className={`p-2.5 rounded-lg text-xs border font-mono ${rowCls}`}>
          {statusMsg.text}
        </div>
      )}

      {report && (
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">USB Móvil: {report.mobileUsb.length}</Badge>
            <Badge tone="neutral">ADB: {report.adbDevices.length}</Badge>
            <Badge tone="neutral">Fastboot: {report.fastbootDevices.length}</Badge>
            <Badge tone={report.mobileProblems.length > 0 ? 'danger' : 'neutral'}>Problemas USB Móvil: {report.mobileProblems.length}</Badge>
            {report.otherProblemsCount > 0 && <Badge tone="neutral">Otros PC: {report.otherProblemsCount}</Badge>}
          </div>
          {report.mobileUsb.map((u) => (
            <div key={u.instanceId} className={`p-2.5 rounded-lg border font-mono text-[11px] flex items-center justify-between gap-2 ${rowCls}`}>
              <div className="min-w-0">
                <div className="font-bold truncate">{u.description || 'Dispositivo USB'} · <span className={mutedCls}>{u.driverInf || 'sin .inf'}</span> · <span className={mutedCls}>{u.status || 'OK'}</span></div>
                <div className={`${mutedCls} truncate mt-0.5`}>{u.instanceId} {u.hardwareId ? `· ${u.hardwareId}` : ''}</div>
              </div>
              <button type="button" onClick={() => handleCopyId(u.instanceId)} className="p-1 rounded hover:bg-zinc-800/40 shrink-0" title="Copiar Instance ID">
                {copiedId === u.instanceId ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          ))}
          {report.mobileProblems.map((p) => (
            <div key={p.instanceId} className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-2 ${rowCls}`}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-bold">{p.description} ({p.driverInf || 'sin driver'})</div>
                <div className={`font-mono ${mutedCls} truncate mt-0.5`}>{p.problemCode || p.status} · {p.instanceId}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
