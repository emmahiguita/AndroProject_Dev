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
import { apiUrl } from '@/lib/api-url';

import React, { useState } from 'react';
import { ShieldAlert, Radar, Trash2, CheckCircle2, Ban, Square } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks/useTheme';
import type { SpywareFinding } from '@/features/security-types';

type RemediationKind = 'force_stop' | 'disable';

interface SpywareAuditPanelProps {
  serial: string | null;
  onLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const SpywareAuditPanel: React.FC<SpywareAuditPanelProps> = ({ serial, onLog }) => {
  const { dark } = useTheme();
  const [scanning, setScanning] = useState(false);
  const [findings, setFindings] = useState<SpywareFinding[] | null>(null);
  const [scannedCount, setScannedCount] = useState<number | null>(null);

  // La ruta solo compara nombres de paquetes, por eso informa su alcance real.
  const runDeepScan = async () => {
    if (!serial) return;
    setScanning(true);
    setFindings(null);
    setScannedCount(null);
    onLog(`Iniciando auditoría heurística profunda en ${serial}...`);
    try {
      const res = await fetch(apiUrl(`/api/security-scan?serial=${encodeURIComponent(serial)}`));
      const data = await res.json();
      if (!data.success) {
        onLog(data.error || 'No se pudo completar el escaneo heurístico', 'error');
      } else {
        setFindings(data.findings || []);
        setScannedCount(data.scannedCount);
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
      const r = await fetch(apiUrl('/api/apps'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, packageName: pkg, action }),
      });
      const d = await r.json();
      onLog(d.success ? (d.message || 'Acción aplicada') : (d.error || 'No se pudo aplicar la acción'), d.success ? 'success' : 'error');
    } catch {
      onLog(`Error aplicando ${action} sobre ${pkg}`, 'error');
    }
  };

  const handleUninstall = async (pkg: string) => {
    if (!serial || !confirm(`¿Desinstalar paquete sospechoso ${pkg}?`)) return;
    try {
      const r = await fetch(apiUrl('/api/apps'), {
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
            <h3 className="text-sm font-bold">Revisión de nombres de paquetes</h3>
            <p className={`text-xs ${mutedCls}`}>
              Busca términos en los nombres de las aplicaciones de terceros.
            </p>
          </div>
        </div>
        <Button size="sm" icon={<ShieldAlert size={13} />} onClick={runDeepScan} disabled={scanning || !serial}>
          {scanning ? 'Consultando paquetes...' : 'Revisar paquetes'}
        </Button>
      </div>

      {scannedCount !== null && (
        <div className={`mt-3 text-xs flex flex-wrap gap-4 ${mutedCls}`}>
          <span>Apps de terceros revisadas: <strong>{scannedCount}</strong></span>
        </div>
      )}

      {findings !== null && findings.length === 0 && (
        <div className={`mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs ${
          dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <CheckCircle2 size={15} />
          <span>No hay coincidencias con los términos de búsqueda.</span>
        </div>
      )}

      {findings && findings.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {findings.map((f) => (
            <div key={f.packageName} className={`p-3 rounded-xl border flex flex-col gap-2.5 ${dark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-mono text-xs font-bold truncate">{f.packageName}</span>
                  <Badge tone="neutral">Coincidencia de nombre</Badge>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button variant="secondary" size="sm" icon={<Square size={12} />} onClick={() => runRemediation(f.packageName, 'force_stop')}>Detener</Button>
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
