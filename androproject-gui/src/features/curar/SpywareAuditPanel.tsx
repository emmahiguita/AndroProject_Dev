// ============================================================================
// ARCHIVO: SpywareAuditPanel.tsx
// QUÉ HACE: Panel de auditoría heurística de spyware, adware y troyanos por
//           comportamiento real (Accesibilidad, Sideload, DeviceAdmin y permisos).
// CÓMO FUNCIONA: Consulta `/api/security-scan?serial=...` y permite desinstalar
//           o revocar cualquier paquete sospechoso detectado en 1 clic.
// POR QUÉ: Detectar amenazas camufladas aunque no coincidan por nombre (<200L).
// ============================================================================
'use client';

import React, { useState } from 'react';
import { ShieldAlert, Radar, Trash2, CheckCircle2 } from 'lucide-react';
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
  const [meta, setMeta] = useState<{ scanned: number; accessCount: number } | null>(null);

  const runDeepScan = async () => {
    if (!serial) return;
    setScanning(true);
    onLog(`Iniciando auditoría heurística de spyware en ${serial}...`);
    try {
      const res = await fetch(`/api/security-scan?serial=${encodeURIComponent(serial)}`);
      const data = await res.json();
      if (!data.success) {
        onLog(data.error || 'No se pudo completar el escaneo heurístico', 'error');
        setFindings([]);
      } else {
        setFindings(data.findings || []);
        setMeta({ scanned: data.scannedThirdParty || 0, accessCount: data.accessibilityCount || 0 });
        onLog(`Escaneo heurístico completado: ${(data.findings || []).length} hallazgos`, 'success');
      }
    } catch {
      onLog('Error de red al ejecutar /api/security-scan', 'error');
    } finally {
      setScanning(false);
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
            <h3 className="text-sm font-bold">Auditoría heurística de Spyware &amp; Permisos</h3>
            <p className={`text-[11px] ${t.textMuted}`}>
              Analiza Accesibilidad activa, Device Admin, apps fuera de Play Store y permisos de micrófono/SMS/overlay.
            </p>
          </div>
        </div>
        <Button size="sm" icon={<ShieldAlert size={13} />} onClick={runDeepScan} disabled={scanning || !serial}>
          {scanning ? 'Analizando kernel...' : 'Escaneo profundo'}
        </Button>
      </div>

      {meta && (
        <div className={`mt-3 text-[11px] flex gap-4 ${t.textMuted}`}>
          <span>Apps de terceros analizadas: <strong>{meta.scanned}</strong></span>
          <span>Servicios de Accesibilidad activos: <strong>{meta.accessCount}</strong></span>
        </div>
      )}

      {findings !== null && findings.length === 0 && (
        <div className={`mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs ${
          dark ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          <CheckCircle2 size={15} />
          <span>No se detectaron combinaciones sospechosas de spyware, sideload peligroso ni accesibilidad abusiva.</span>
        </div>
      )}

      {findings && findings.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {findings.map((f) => (
            <div
              key={f.packageName}
              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                dark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold truncate">{f.packageName}</span>
                  <Badge tone={f.severity === 'critical' ? 'danger' : 'warning'}>
                    {f.severity.toUpperCase()} · {f.score} pts
                  </Badge>
                </div>
                <ul className={`mt-1.5 text-[11px] space-y-0.5 ${t.textMuted}`}>
                  {f.reasons.map((r) => <li key={r}>• {r}</li>)}
                </ul>
              </div>
              <Button variant="danger" size="sm" icon={<Trash2 size={12} />} onClick={() => handleUninstall(f.packageName)}>
                Desinstalar
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
