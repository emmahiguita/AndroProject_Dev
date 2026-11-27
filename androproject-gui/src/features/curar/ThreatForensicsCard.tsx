// ============================================================================
// ARCHIVO: curar/ThreatForensicsCard.tsx
// QUÉ HACE: Tarjeta de inspección forense defensiva de paquetes Android:
//           proveedor/instalador, SHA-256 del APK, targetSdk, permisos activos,
//           cómo operan/se conectan y explicación con modelo IA local (Ollama).
// CÓMO FUNCIONA: Consulta `GET /api/security-forensics` y `POST /api/security-forensics`
//           junto con los modelos detectados en `/api/ai-cli`.
// POR QUÉ: Dar visibilidad técnica real sobre amenazas y paquetes sospechosos
//          sin simulaciones y manteniendo el componente < 185 líneas (SRP).
// ============================================================================
'use client';

import React, { useEffect, useState } from 'react';
import { Microscope, Sparkles, Loader2, ShieldCheck, Activity } from 'lucide-react';
import { apiUrl } from '@/lib/api-url';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks/useTheme';

interface ForensicsReport {
  packageName: string;
  provider: string;
  versionName: string;
  targetSdk: number;
  apkSha256: string;
  isRunningNow: boolean;
  isDebuggable: boolean;
  usesCleartextTraffic: boolean;
  grantedSensitivePermissions: { permission: string; impact: string }[];
  howItWorks: string[];
  mitigationSteps: string[];
}

interface ThreatForensicsCardProps {
  serial: string | null;
  initialPackage?: string;
}

export const ThreatForensicsCard: React.FC<ThreatForensicsCardProps> = ({ serial, initialPackage }) => {
  const { dark } = useTheme();
  const [pkg, setPkg] = useState(initialPackage || '');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [report, setReport] = useState<ForensicsReport | null>(null);
  const [aiText, setAiText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialPackage) setPkg(initialPackage);
  }, [initialPackage]);

  useEffect(() => {
    fetch(apiUrl('/api/ai-cli')).then((r) => r.json()).then((d) => {
      const list: string[] = d.ollama?.models || [];
      setModels(list);
      if (list.length > 0) setModel(list[0]);
    }).catch(() => {});
  }, []);

  const inspectPackage = async () => {
    if (!serial || !pkg.trim()) return;
    setLoading(true);
    setError('');
    setAiText('');
    try {
      const res = await fetch(apiUrl(`/api/security-forensics?serial=${encodeURIComponent(serial)}&packageName=${encodeURIComponent(pkg.trim())}`));
      const data = await res.json();
      if (data.success) setReport(data);
      else setError(data.error || 'No se pudo inspeccionar el paquete.');
    } catch { setError('Error de red consultando /api/security-forensics.'); }
    finally { setLoading(false); }
  };

  const explainWithAi = async () => {
    if (!serial || !pkg.trim() || !model) return;
    setAiLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/security-forensics'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, packageName: pkg.trim(), model }),
      });
      const data = await res.json();
      if (data.report) setReport(data.report);
      if (data.success) setAiText(data.aiAnalysis || '');
      else setError(data.error || 'El modelo local no pudo generar el análisis.');
    } catch { setError('Error de red consultando el análisis IA local.'); }
    finally { setAiLoading(false); }
  };

  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';
  const boxCls = dark ? 'bg-zinc-900/70 border-zinc-800' : 'bg-slate-50 border-slate-200';

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${boxCls}`}>
            <Microscope size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold">Inspección Forense de Paquetes + Explicación IA Local</h3>
            <p className={`text-xs ${mutedCls}`}>Extrae proveedor, hash SHA-256 del APK, targetSdk, permisos sensibles, persistencia y explica cómo opera.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            value={pkg}
            onChange={(e) => setPkg(e.target.value)}
            placeholder="Nombre del paquete (ej: com.whatsapp o cualquier hallazgo)..."
            className={`flex-1 min-w-[220px] rounded-lg border px-3 py-1.5 text-xs font-mono outline-none ${boxCls}`}
          />
          {models.length > 0 && (
            <select value={model} onChange={(e) => setModel(e.target.value)} className={`max-w-[210px] rounded-lg border px-2 py-1.5 text-xs outline-none ${boxCls}`}>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <Button size="sm" variant="secondary" icon={loading ? <Loader2 size={12} className="animate-spin" /> : <Microscope size={12} />} disabled={!serial || !pkg.trim() || loading} onClick={inspectPackage}>
            {loading ? 'Analizando...' : 'Inspeccionar APK'}
          </Button>
          <Button size="sm" variant="primary" icon={aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} disabled={!serial || !pkg.trim() || !model || aiLoading} onClick={explainWithAi}>
            {aiLoading ? 'Explicando...' : 'Explicar con IA'}
          </Button>
        </div>

        {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

        {report && (
          <div className={`rounded-xl border p-3.5 space-y-2.5 text-xs ${boxCls}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold">{report.packageName}</span>
              <Badge tone="neutral">v{report.versionName}</Badge>
              <Badge tone={report.targetSdk < 29 ? 'warning' : 'neutral'}>targetSdk {report.targetSdk}</Badge>
              <Badge tone={report.isRunningNow ? 'warning' : 'neutral'}><Activity size={10} /> {report.isRunningNow ? 'Activo en RAM' : 'Detenido'}</Badge>
              {report.isDebuggable && <Badge tone="danger">DEBUGGABLE</Badge>}
              {report.usesCleartextTraffic && <Badge tone="warning">HTTP sin cifrar</Badge>}
            </div>

            <div className={`font-mono text-[11px] space-y-0.5 break-all ${mutedCls}`}>
              <div><strong>Proveedor / Instalador:</strong> {report.provider}</div>
              {report.apkSha256 && <div><strong>SHA-256 APK:</strong> {report.apkSha256}</div>}
            </div>

            <div>
              <p className="font-semibold mb-1">Cómo funciona y cómo se conecta:</p>
              <ul className={`space-y-0.5 ${mutedCls}`}>
                {report.howItWorks.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>

            {report.grantedSensitivePermissions.length > 0 && (
              <div>
                <p className="font-semibold mb-1">Permisos sensibles detectados ({report.grantedSensitivePermissions.length}):</p>
                <ul className={`space-y-0.5 font-mono text-[11px] ${mutedCls}`}>
                  {report.grantedSensitivePermissions.map((p) => <li key={p.permission}>• {p.permission.replace('android.permission.', '')} — {p.impact}</li>)}
                </ul>
              </div>
            )}

            <div>
              <p className="font-semibold mb-1 flex items-center gap-1"><ShieldCheck size={12} /> Mitigación defensiva:</p>
              <ul className={`space-y-0.5 ${mutedCls}`}>
                {report.mitigationSteps.map((s) => <li key={s}>• {s}</li>)}
              </ul>
            </div>
          </div>
        )}

        {aiText && (
          <pre className={`rounded-xl border p-3.5 text-xs whitespace-pre-wrap font-mono ${boxCls}`}>
            {aiText}
          </pre>
        )}
      </div>
    </Card>
  );
};
