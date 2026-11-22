// ============================================================================
// ARCHIVO: SpywareAuditPanel.tsx
// QUÉ HACE: Panel de auditoría heurística de publicidad invasora (adware),
//           spyware y troyanos por comportamiento real, con corte inmediato.
// CÓMO FUNCIONA: Consulta `/api/security-scan` (GET) y permite revocar overlay
//           flotante, detener el proceso o desinstalar el paquete en 1 clic.
// POR QUÉ: Detectar y frenar anuncios invasivos y spyware camuflado (< 200L).
// ============================================================================
'use client';

import React, { useState } from 'react';
import { ShieldAlert, Radar, Trash2, CheckCircle2, Ban, Square } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks/useTheme';
import type { SpywareFinding } from '@/lib/services/spyware-heuristic-scanner';

interface SpywareAuditPanelProps {
  serial: string | null;
  onLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const SpywareAuditPanel: React.FC<SpywareAuditPanelProps> = ({ serial, onLog }) => {
  const { dark, t } = useTheme();
  const [scanning, setScanning] = useState(false);
  const [findings, setFindings] = useState<SpywareFinding[] | null>(null);
  const [meta, setMeta] = useState<{ scanned: number; accessCount: number; topPkg: string | null } | null>(null);

  const runDeepScan = async () => {
    if (!serial) return;
    setScanning(true);
    onLog(`Iniciando auditoría heurística de adware/spyware en ${serial}...`);
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

  const runRemediation = async (pkg: string, action: 'revoke_overlay' | 'force_stop' | 'suspend') => {
    if (!serial) return;
    try {
      const r = await fetch('/api/security-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, packageName: pkg, action }),
      });
      const d = await r.json();
      onLog(d.message || d.error || 'Acción aplicada', d.success ? 'success' : 'error');
      if (d.success && action === 'revoke_overlay') runDeepScan();
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

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Radar size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold">Auditoría heurística: Adware Invasivo, Spyware &amp; Virus</h3>
            <p className={`text-[11px] ${t.textMuted}`}>
              Detecta apps ocultas sin ícono, overlays publicitarios, Accesibilidad activa, sideload y permisos sensibles.
            </p>
          </div>
        </div>
        <Button size="sm" icon={<ShieldAlert size={13} />} onClick={runDeepScan} disabled={scanning || !serial}>
          {scanning ? 'Analizando kernel...' : 'Escaneo profundo'}
        </Button>
      </div>

      {meta && (
        <div className={`mt-3 text-[11px] flex flex-wrap gap-4 ${t.textMuted}`}>
          <span>Apps de terceros: <strong>{meta.scanned}</strong></span>
          <span>Accesibilidad activa: <strong>{meta.accessCount}</strong></span>
          {meta.topPkg && <span>Ventana actual: <strong className="font-mono">{meta.topPkg}</strong></span>}
        </div>
      )}

      {findings !== null && findings.length === 0 && (
        <div className={`mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs ${
          dark ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          <CheckCircle2 size={15} />
          <span>No se detectaron combinaciones sospechosas de adware invasivo, spyware ni accesibilidad abusiva.</span>
        </div>
      )}

      {findings && findings.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {findings.map((f) => (
            <div
              key={f.packageName}
              className={`p-3 rounded-xl border flex flex-col gap-2.5 ${
                dark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-mono text-xs font-bold truncate">{f.packageName}</span>
                  <Badge tone={f.severity === 'critical' ? 'danger' : 'warning'}>
                    {f.category.toUpperCase()} · {f.severity.toUpperCase()} · {f.score} pts
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {f.hasOverlay && (
                    <Button variant="secondary" size="sm" icon={<Ban size={12} />} onClick={() => runRemediation(f.packageName, 'revoke_overlay')}>
                      Cortar Overlay
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" icon={<Square size={12} />} onClick={() => runRemediation(f.packageName, 'force_stop')}>
                    Detener
                  </Button>
                  <Button variant="secondary" size="sm" icon={<Ban size={12} />} onClick={() => runRemediation(f.packageName, 'suspend')}>
                    Congelar
                  </Button>
                  <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => handleUninstall(f.packageName)}>
                    Desinstalar
                  </Button>
                </div>
              </div>
              <ul className={`text-[11px] space-y-0.5 ${t.textMuted}`}>
                {f.reasons.map((r) => <li key={r}>• {r}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
