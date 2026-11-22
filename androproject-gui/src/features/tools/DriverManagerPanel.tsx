// ============================================================================
// ARCHIVO: DriverManagerPanel.tsx
// QUÉ HACE: Panel de Windows DriverManager en Herramientas (diagnóstico USB
//           PnPUtil, detección de errores CM_PROB, verificación `.cat` e
//           instalación segura de paquetes `.inf` OEM).
// CÓMO FUNCIONA: Consulta `/api/drivers` (GET) y despacha `verify_cat` o
//           `install_inf` (POST) con retroalimentación clara y verificable.
// POR QUÉ: Separar la gestión de drivers Windows del Flasheador (< 200L, SRP).
// ============================================================================
'use client';

import React, { useState } from 'react';
import { Usb, ShieldCheck, AlertTriangle, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks/useTheme';
import type { DriverScanReport } from '@/lib/services/driver-manager';

export const DriverManagerPanel: React.FC = () => {
  const { dark, t } = useTheme();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DriverScanReport | null>(null);
  const [driverPath, setDriverPath] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const scanDrivers = async () => {
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
    } finally {
      setLoading(false);
    }
  };

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
      setStatusMsg({ text: d.message || d.error || 'Completado', ok: Boolean(d.success) });
      if (action === 'install_inf' && d.success) scanDrivers();
    } catch {
      setStatusMsg({ text: 'Error comunicando con /api/drivers', ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-3.5 space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dark ? 'bg-sky-500/10 text-sky-400' : 'bg-sky-100 text-sky-600'}`}>
            <Usb size={14} />
          </div>
          <div>
            <h2 className={`text-xs font-bold ${t.text}`}>DriverManager USB Windows (PnPUtil)</h2>
            <p className={`text-[10px] ${t.textMuted}`}>Diagnostica VID/PID, errores USB, firma `.cat` e instala `.inf` OEM sin romper MTP/ADB.</p>
          </div>
        </div>
        <Button size="sm" icon={<RefreshCw size={12} className={loading ? 'animate-spin' : ''} />} onClick={scanDrivers} disabled={loading}>
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
        <div className={`p-2 rounded-lg text-[11px] border ${
          statusMsg.ok
            ? dark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : dark ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {statusMsg.text}
        </div>
      )}

      {report && (
        <div className="space-y-2 text-[11px]">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">USB Móvil: {report.mobileUsb.length}</Badge>
            <Badge tone="neutral">ADB: {report.adbDevices.length}</Badge>
            <Badge tone="neutral">Fastboot: {report.fastbootDevices.length}</Badge>
            <Badge tone={report.mobileProblems.length > 0 ? 'warning' : 'success'}>
              Problemas USB Móvil: {report.mobileProblems.length}
            </Badge>
            {report.otherProblemsCount > 0 && (
              <Badge tone="neutral">Otros PC: {report.otherProblemsCount}</Badge>
            )}
          </div>
          {report.mobileUsb.map((u) => (
            <div key={u.instanceId} className={`p-2 rounded-lg border font-mono text-[10px] ${dark ? 'bg-zinc-900/70 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="font-bold">{u.description || 'Dispositivo USB'} · <span className="text-sky-400">{u.driverInf || 'sin .inf'}</span></div>
              <div className="opacity-70 truncate">{u.instanceId}</div>
            </div>
          ))}
          {report.mobileProblems.map((p) => (
            <div key={p.instanceId} className={`p-2 rounded-lg border text-[10px] flex items-start gap-2 ${dark ? 'bg-amber-500/5 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-bold">{p.description} ({p.driverInf || 'sin driver'})</div>
                <div className="font-mono opacity-80 truncate">{p.problemCode || p.status} · {p.instanceId}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
