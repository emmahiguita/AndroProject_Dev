// ============================================================================
// ARCHIVO: CurarView.tsx
// QUÉ HACE: Vista principal de Seguridad y Curación Android (escaneo heurístico
//           de spyware por permisos/accesibilidad + firmas conocidas + capturas).
// CÓMO FUNCIONA: Coordina `SpywareAuditPanel` y `ScreenshotPanel` en pestañas
//           monocromas de alto contraste sin iconos ni textos coloridos.
// POR QUÉ: Mantener la UI modular (< 200 líneas, SRP) y 100% legible.
// ============================================================================
'use client';

import { Shield, ShieldAlert, AlertTriangle, Trash2 } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { useActions } from '@/hooks/useActions';
import { ViewShell } from '@/components/ViewShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SpywareAuditPanel } from './curar/SpywareAuditPanel';
import { ScreenshotPanel } from './curar/ScreenshotPanel';
import type { DeviceInfo } from './types';

interface CurarViewProps {
  device?: DeviceInfo | null;
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function CurarView({ addLog: propAddLog }: CurarViewProps = {}) {
  const { dark } = useTheme();
  const curarSubTab = useAppStore((s) => s.curarSubTab);
  const setCurarSubTab = useAppStore((s) => s.setCurarSubTab);

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
          {tab('antivirus', <ShieldAlert size={13} />, 'Análisis de Seguridad')}
          {tab('screenshot', <Shield size={13} />, 'Compatibilidad de Capturas')}
        </div>
        {curarSubTab === 'antivirus' ? <AntivirusPanel propAddLog={propAddLog} /> : <ScreenshotPanel />}
      </div>
    </ViewShell>
  );
}

function AntivirusPanel({ propAddLog }: { propAddLog?: (msg: string, type?: 'info' | 'success' | 'error') => void }) {
  const { dark } = useTheme();
  const appsList = useAppStore((s) => s.appsList);
  const appsLoading = useAppStore((s) => s.appsLoading);
  const device = useAppStore((s) => s.device);
  const activeSerial = useAppStore((s) => s.activeSerial);
  const storeAddLog = useAppStore((s) => s.addLog);
  const addLog = (msg: string, type?: 'info' | 'success' | 'error') => {
    if (propAddLog) propAddLog(msg, type);
    else storeAddLog(msg);
  };
  const { fetchApps } = useActions();
  const malwareApps = appsList.filter((app) => app.isMalware);

  const handleRemove = async (pkg: string) => {
    if (!confirm(`¿Desinstalar amenaza ${pkg}?`)) return;
    try {
      const r = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uninstall', packageName: pkg, serial: activeSerial }),
      });
      const d = await r.json();
      if (d.success) { addLog(`Amenaza ${pkg} eliminada.`, 'success'); fetchApps(); }
      else addLog(`Error al eliminar: ${d.error}`, 'error');
    } catch { addLog(`Error de red al eliminar ${pkg}`, 'error'); }
  };

  const iconBoxCls = `w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
    dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'
  }`;
  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';

  return (
    <div className="space-y-4">
      <SpywareAuditPanel serial={activeSerial || device?.serial || null} onLog={addLog} />

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={iconBoxCls}><ShieldAlert size={18} /></div>
            <div>
              <h2 className="text-sm font-bold">Indicadores conocidos de Malware / HiddenAds</h2>
              <p className={`text-xs ${mutedCls}`}>Coteja paquetes instalados contra firmas conocidas de troyanos y adware.</p>
            </div>
          </div>
          {appsList.length === 0 && (
            <Button size="sm" variant="secondary" icon={<Shield size={13} />} onClick={fetchApps} disabled={appsLoading || !device?.connected}>
              {appsLoading ? 'Cargando...' : 'Cargar apps'}
            </Button>
          )}
        </div>
      </Card>

      {appsList.length > 0 && malwareApps.length === 0 && (
        <Card className="border-border text-center">
          <Shield size={22} className={`mx-auto mb-2 ${dark ? 'text-zinc-300' : 'text-slate-700'}`} />
          <p className="font-bold text-xs">Sin coincidencias por nombre de paquete</p>
          <p className={`text-xs ${mutedCls} mt-1`}>Usa el botón <strong>Escaneo profundo</strong> arriba para auditar permisos, Accesibilidad y apps ocultas.</p>
        </Card>
      )}

      {malwareApps.length > 0 && (
        <div className="space-y-2">
          {malwareApps.map((app, idx) => (
            <Card key={app.packageName ? `${app.packageName}-${idx}` : `malware-${idx}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span className="font-bold text-xs truncate">{app.name}</span>
                    <Badge tone="danger">{app.threatName || 'Sospechosa'}</Badge>
                  </div>
                  <p className={`text-[11px] font-mono mt-0.5 ${mutedCls}`}>{app.packageName}</p>
                </div>
                <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => handleRemove(app.packageName)}>
                  Desinstalar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
