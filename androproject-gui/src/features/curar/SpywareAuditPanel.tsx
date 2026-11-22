// ============================================================================
// ARCHIVO: SpywareAuditPanel.tsx
// QUÉ HACE: Panel de auditoría heurística de publicidad invasora (adware),
//           apps ocultas sin icono, spyware y troyanos con remediación total.
// CÓMO FUNCIONA: Consulta `/api/security-scan` (GET) y permite revocar overlay,
//           accesibilidad, notificaciones, instalación de APKs, detener proceso,
//           congelar, deshabilitar o desinstalar en 1 clic.
// POR QUÉ: Detectar y neutralizar amenazas reales sin componentes huérfanos (< 200L).
// ============================================================================
'use client';

import React, { useState } from 'react';
import { ShieldAlert, Radar, Trash2, CheckCircle2, Ban, Square, EyeOff, BellOff } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks/useTheme';
import type { SpywareFinding } from '@/lib/services/spyware-heuristic-scanner';

type RemediationKind =
  | 'revoke_overlay'
  | 'revoke_install_packages'
  | 'revoke_accessibility'
  | 'revoke_notifications'
  | 'force_stop'
  | 'disable'
  | 'suspend'
  | 'unsuspend';

interface SpywareAuditPanelProps {
  serial: string | null;
  onLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const SpywareAuditPanel: React.FC<SpywareAuditPanelProps> = ({ serial, onLog }) => {
  const { dark } = useTheme();
  const [scanning, setScanning] = useState(false);
  const [findings, setFindings] = useState<SpywareFinding[] | null>(null);
  const [suspendedPkgs, setSuspendedPkgs] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<{ scanned: number; hiddenCount: number; accessCount: number; topPkg: string | null } | null>(null);

  const runDeepScan = async () => {
    if (!serial) return;
    setScanning(true);
    onLog(`Iniciando auditoría heurística profunda en ${serial}...`);
    try {
      const res = await fetch(`/api/security-scan?serial=${encodeURIComponent(serial)}`);
      const data = await res.json();
      if (!data.success) {
        onLog(data.error || 'No se pudo completar el escaneo heurístico', 'error');
        setFindings([]);
      } else {
        setFindings(data.findings || []);
        setMeta({
          scanned: data.scannedThirdParty || 0,
          hiddenCount: data.hiddenAppsCount || 0,
          accessCount: data.accessibilityCount || 0,
          topPkg: data.topWindowPkg || null,
        });
        onLog(`Escaneo heurístico completado: ${(data.findings || []).length} hallazgos`, 'success');
      }
    } catch {
      onLog('Error de red al ejecutar /api/security-scan', 'error');
    } finally {
      setScanning(false);
    }
  };

  const runRemediation = async (pkg: string, action: RemediationKind) => {
    if (!serial) return;
    try {
      const r = await fetch('/api/security-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, packageName: pkg, action }),
      });
      const d = await r.json();
      onLog(d.message || d.error || 'Acción aplicada', d.success ? 'success' : 'error');
      if (d.success && action.startsWith('revoke_')) runDeepScan();
      if (d.success && (action === 'suspend' || action === 'unsuspend')) {
        setSuspendedPkgs((prev) => {
          const next = new Set(prev);
          if (action === 'suspend') next.add(pkg); else next.delete(pkg);
          return next;
        });
      }
    } catch {
      onLog(`Error aplicando ${action} sobre ${pkg}`, 'error');
    }
  };

  const handleUninstall = async (pkg: string) => {
    if (!serial || !confirm(`¿Desinstalar paquete sospechoso ${pkg}?`)) return;
    try {
      const r = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uninstall', packageName: pkg, serial }),
      });
      const d = await r.json();
      if (d.success) {
        setFindings((prev) => (prev ? prev.filter((f) => f.packageName !== pkg) : prev));
        onLog(`${pkg} eliminado del dispositivo.`, 'success');
      } else {
        onLog(d.error || `No se pudo desinstalar ${pkg}`, 'error');
      }
    } catch {
      onLog(`Error al desinstalar ${pkg}`, 'error');
    }
  };

  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            <Radar size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold">Auditoría heurística: Adware Invasivo, Spyware &amp; Apps Ocultas</h3>
            <p className={`text-xs ${mutedCls}`}>
              Detecta apps sin ícono en launcher, overlays publicitarios, Accesibilidad abusiva, escucha de notificaciones y sideload.
            </p>
          </div>
        </div>
        <Button size="sm" icon={<ShieldAlert size={13} />} onClick={runDeepScan} disabled={scanning || !serial}>
          {scanning ? 'Analizando kernel...' : 'Escaneo profundo'}
        </Button>
      </div>

      {meta && (
        <div className={`mt-3 text-xs flex flex-wrap gap-4 ${mutedCls}`}>
          <span>Apps de terceros: <strong>{meta.scanned}</strong></span>
          <span>Apps ocultas sin icono: <strong>{meta.hiddenCount}</strong></span>
          <span>Accesibilidad activa: <strong>{meta.accessCount}</strong></span>
          {meta.topPkg && <span>Ventana actual: <strong className="font-mono">{meta.topPkg}</strong></span>}
        </div>
      )}

      {findings !== null && findings.length === 0 && (
        <div className={`mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs ${
          dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <CheckCircle2 size={15} />
          <span>No se detectaron combinaciones sospechosas de adware invasivo, spyware ni accesibilidad abusiva.</span>
        </div>
      )}

      {findings && findings.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {findings.map((f) => (
            <div key={f.packageName} className={`p-3 rounded-xl border flex flex-col gap-2.5 ${dark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-mono text-xs font-bold truncate">{f.packageName}</span>
                  <Badge tone="neutral">{f.category.toUpperCase()} · {f.severity.toUpperCase()} · {f.score} pts</Badge>
                  {f.isHidden && <Badge tone="danger">APP OCULTA</Badge>}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {f.hasOverlay && (
                    <Button variant="secondary" size="sm" icon={<Ban size={12} />} onClick={() => runRemediation(f.packageName, 'revoke_overlay')}>Cortar Overlay</Button>
                  )}
                  {f.hasAccessibility && (
                    <Button variant="secondary" size="sm" icon={<EyeOff size={12} />} onClick={() => runRemediation(f.packageName, 'revoke_accessibility')}>Quitar Accesibilidad</Button>
                  )}
                  {f.hasNotificationAccess && (
                    <Button variant="secondary" size="sm" icon={<BellOff size={12} />} onClick={() => runRemediation(f.packageName, 'revoke_notifications')}>Quitar Notifs</Button>
                  )}
                  {f.hasInstallPackages && (
                    <Button variant="secondary" size="sm" icon={<Ban size={12} />} onClick={() => runRemediation(f.packageName, 'revoke_install_packages')}>Bloquear APK</Button>
                  )}
                  <Button variant="secondary" size="sm" icon={<Square size={12} />} onClick={() => runRemediation(f.packageName, 'force_stop')}>Detener</Button>
                  <Button variant="secondary" size="sm" icon={<Ban size={12} />} onClick={() => runRemediation(f.packageName, suspendedPkgs.has(f.packageName) ? 'unsuspend' : 'suspend')}>
                    {suspendedPkgs.has(f.packageName) ? 'Descongelar' : 'Congelar'}
                  </Button>
                  <Button variant="secondary" size="sm" icon={<Ban size={12} />} onClick={() => runRemediation(f.packageName, 'disable')}>Deshabilitar</Button>
                  <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => handleUninstall(f.packageName)}>Desinstalar</Button>
                </div>
              </div>
              <ul className={`text-xs space-y-0.5 ${mutedCls}`}>
                {f.reasons.map((r) => <li key={r}>• {r}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
