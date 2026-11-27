// ============================================================================
// ARCHIVO: CurarView.tsx
// QUÉ HACE: Vista principal de Seguridad y Curación Android (escaneo heurístico
//           de spyware, Escudo DNS Anti-Adware AdGuard, firmas de malware y
//           diagnóstico/parcheo de compatibilidad de capturas).
// CÓMO FUNCIONA: Coordina `SpywareAuditPanel`, el escudo `set_adguard_dns`, el
//           detector de firmas de `appsList` y `ScreenshotPanel`.
// POR QUÉ: Unificar toda la lógica de seguridad y eliminar props/estados
//          huérfanos manteniendo < 200 líneas (SRP).
// ============================================================================
'use client';
import { apiUrl } from '@/lib/api-url';

import React, { useState } from 'react';
import { Shield, ShieldAlert, AlertTriangle, Trash2, Globe, Ban, Square } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { useActions } from '@/hooks/useActions';
import { ViewShell } from '@/components/ViewShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SpywareAuditPanel } from './curar/SpywareAuditPanel';
import { ThreatForensicsCard } from './curar/ThreatForensicsCard';
import { ScreenshotPanel } from './curar/ScreenshotPanel';
import type { DeviceInfo } from './types';
import type { AdguardProfile } from '@/stores/optimizerSlice';

interface CurarViewProps {
  device?: DeviceInfo | null;
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function CurarView({ device: propDevice, addLog: propAddLog }: CurarViewProps = {}) {
  const { dark } = useTheme();
  const curarSubTab = useAppStore((s) => s.curarSubTab);
  const setCurarSubTab = useAppStore((s) => s.setCurarSubTab);
  const storeDevice = useAppStore((s) => s.device);
  const activeSerial = useAppStore((s) => s.activeSerial);
  const targetSerial = activeSerial || propDevice?.serial || storeDevice?.serial || null;

  const tab = (id: 'antivirus' | 'screenshot', icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setCurarSubTab(id)}
      className={`pb-2 px-3 font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
        curarSubTab === id
          ? dark ? 'border-zinc-100 text-zinc-100' : 'border-slate-900 text-slate-900'
          : `border-transparent ${dark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'}`
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <ViewShell navId="curar">
      <div className="mx-auto w-full min-w-0 max-w-4xl">
        <div className={`custom-scrollbar flex gap-4 overflow-x-auto border-b ${dark ? 'border-zinc-800' : 'border-slate-200'} mb-3`}>
          {tab('antivirus', <ShieldAlert size={13} />, 'Análisis de Seguridad y Anti-Adware')}
          {tab('screenshot', <Shield size={13} />, 'Compatibilidad de Capturas (FLAG_SECURE)')}
        </div>
        {curarSubTab === 'antivirus' ? (
          <AntivirusPanel serial={targetSerial} propAddLog={propAddLog} />
        ) : (
          <ScreenshotPanel serial={targetSerial} />
        )}
      </div>
    </ViewShell>
  );
}

function AntivirusPanel({ serial, propAddLog }: { serial: string | null; propAddLog?: (msg: string, type?: 'info' | 'success' | 'error') => void }) {
  const { dark } = useTheme();
  const appsList = useAppStore((s) => s.appsList);
  const appsLoading = useAppStore((s) => s.appsLoading);
  const adguardProfile = useAppStore((s) => s.adguardProfile);
  const setAdguardProfile = useAppStore((s) => s.setAdguardProfile);
  const storeAddLog = useAppStore((s) => s.addLog);
  const [dnsBusy, setDnsBusy] = useState(false);

  const addLog = (msg: string, type?: 'info' | 'success' | 'error') => (propAddLog ? propAddLog(msg, type) : storeAddLog(msg));
  const { fetchApps, run } = useActions();
  const malwareApps = appsList.filter((app) => app.isMalware || app.hasOverlay || app.isHidden);

  const handleApplyAdguard = async (profile: AdguardProfile) => {
    if (!serial) return;
    setDnsBusy(true);
    try {
      const res = await run('set_adguard_dns', `Configurando escudo AdGuard DNS (${profile})`, { profile, serial });
      if (res.success) { setAdguardProfile(profile); addLog(`Escudo AdGuard DNS configurado en modo "${profile}".`, 'success'); }
      else addLog(res.error || 'Error aplicando AdGuard DNS', 'error');
    } finally { setDnsBusy(false); }
  };

  const handlePkgAction = async (pkg: string, action: 'uninstall' | 'disable' | 'force_stop') => {
    if (action === 'uninstall' && !confirm(`¿Desinstalar amenaza ${pkg}?`)) return;
    try {
      const r = await fetch(apiUrl('/api/apps'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, packageName: pkg, serial,
          confirmed: action === 'uninstall' || action === 'disable',
        }),
      });
      const d = await r.json();
      if (d.success) { addLog(`Acción ${action} aplicada sobre ${pkg}.`, 'success'); fetchApps(); }
      else addLog(`Error (${action}): ${d.error}`, 'error');
    } catch { addLog(`Error de red en ${pkg}`, 'error'); }
  };

  const iconBoxCls = `w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'}`;
  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';

  return (
    <div className="space-y-3.5">
      <SpywareAuditPanel key={serial || 'none'} serial={serial} onLog={addLog} />
      <ThreatForensicsCard key={`forensics-${serial || 'none'}`} serial={serial} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={iconBoxCls}><Globe size={18} /></div>
            <div>
              <h2 className="text-sm font-bold">Escudo de Red Anti-Adware (AdGuard Private DNS)</h2>
              <p className={`text-xs ${mutedCls}`}>Bloquea dominios de publicidad invasiva, popups y rastreadores a nivel sistema en Android 9+.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              { id: 'default', label: 'Bloquear Anuncios' },
              { id: 'family', label: 'Escudo Familiar + Malware' },
              { id: 'off', label: 'DNS Desactivado' },
            ] as { id: AdguardProfile; label: string }[]).map((opt) => (
              <Button key={opt.id} size="sm" variant={adguardProfile === opt.id ? 'primary' : 'secondary'} disabled={!serial || dnsBusy} onClick={() => handleApplyAdguard(opt.id)}>
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={iconBoxCls}><ShieldAlert size={18} /></div>
            <div>
              <h2 className="text-sm font-bold">Indicadores del catálogo de aplicaciones</h2>
              <p className={`text-xs ${mutedCls}`}>Muestra los indicadores proporcionados por el catálogo del dispositivo.</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" icon={<Shield size={13} />} onClick={fetchApps} disabled={appsLoading || !serial}>
            {appsLoading ? 'Analizando...' : appsList.length > 0 ? 'Reescanear catálogo' : 'Analizar catálogo'}
          </Button>
        </div>
      </Card>

      {appsList.length > 0 && malwareApps.length === 0 && (
        <Card className="border-border text-center">
          <Shield size={22} className={`mx-auto mb-2 ${dark ? 'text-zinc-300' : 'text-slate-700'}`} />
          <p className="font-bold text-xs">Sin indicadores en el catálogo ({appsList.length} paquetes)</p>
          <p className={`text-xs ${mutedCls} mt-1`}>El catálogo no realiza un análisis antivirus de los paquetes.</p>
        </Card>
      )}

      {malwareApps.length > 0 && (
        <div className="space-y-2">
          {malwareApps.map((app, idx) => (
            <Card key={app.packageName ? `${app.packageName}-${idx}` : `malware-${idx}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span className="font-bold text-xs truncate">{app.name}</span>
                    <Badge tone="danger">{app.threatName || (app.isHidden ? 'App Oculta sin Icono' : 'Adware / Sospechosa')}</Badge>
                  </div>
                  <p className={`text-[11px] font-mono mt-0.5 ${mutedCls}`}>{app.packageName}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="secondary" size="sm" icon={<Square size={12} />} onClick={() => handlePkgAction(app.packageName, 'force_stop')}>Detener</Button>
                  <Button variant="secondary" size="sm" icon={<Ban size={12} />} onClick={() => handlePkgAction(app.packageName, 'disable')}>Deshabilitar</Button>
                  <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => handlePkgAction(app.packageName, 'uninstall')}>Desinstalar</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
