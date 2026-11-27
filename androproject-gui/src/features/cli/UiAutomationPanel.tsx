// ============================================================================
// ARCHIVO: cli/UiAutomationPanel.tsx
// QUÉ HACE: Panel de inspección y navegación UI Android vía UIAutomator real
//           (`/api/ui-automation`) con planificación asistida por modelo local.
// CÓMO FUNCIONA: Captura nodos reales de la pantalla del teléfono, muestra sus
//           etiquetas y coordenadas `(x, y)` y ejecuta `tap` / `key` / `text`
//           solo cuando el usuario hace clic explícito (confirmación humana).
// POR QUÉ: Integrar automatización UI real tipo Observe-Think-Act en ANDRO-IOS
//          manteniendo el componente desacoplado y < 170 líneas (SRP).
// ============================================================================
'use client';

import React, { useState } from 'react';
import { ScanEye, MousePointerClick, Home, ArrowLeft, Layers, Sparkles, Loader2 } from 'lucide-react';
import { apiUrl } from '@/lib/api-url';
import { Button } from '@/components/ui/Button';

interface UiElement {
  label: string;
  resourceId: string;
  clickable: boolean;
  x: number;
  y: number;
}

interface UiAutomationPanelProps {
  serial?: string;
  connected?: boolean;
  model: string;
  ollamaOnline: boolean;
  dark: boolean;
}

export const UiAutomationPanel: React.FC<UiAutomationPanelProps> = ({
  serial, connected, model, ollamaOnline, dark,
}) => {
  const [loading, setLoading] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [elements, setElements] = useState<UiElement[]>([]);
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');

  const cardCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';
  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';
  const canUse = Boolean(serial && connected);

  const inspectScreen = async () => {
    if (!canUse || !serial) return;
    setLoading(true);
    setStatus('');
    try {
      const res = await fetch(apiUrl(`/api/ui-automation?serial=${encodeURIComponent(serial)}`));
      const data = await res.json();
      if (data.success) {
        setElements(data.elements || []);
        setStatus(`Detectados ${data.count ?? 0} elementos reales en la pantalla actual.`);
      } else {
        setStatus(data.error || 'No se pudo inspeccionar la pantalla.');
      }
    } catch { setStatus('Error de red consultando /api/ui-automation.'); }
    finally { setLoading(false); }
  };

  const runAction = async (payload: Record<string, unknown>, label: string) => {
    if (!canUse || !serial) return;
    setStatus(`Ejecutando ${label}...`);
    try {
      const res = await fetch(apiUrl('/api/ui-automation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, confirmed: true, ...payload }),
      });
      const data = await res.json();
      setStatus(data.success ? `OK: ${label} (${data.command})` : (data.error || 'Error ejecutando acción UI.'));
      if (data.success) setTimeout(inspectScreen, 600);
    } catch { setStatus('Error de red ejecutando acción UI.'); }
  };

  const generatePlan = async () => {
    if (!canUse || !serial || !goal.trim() || !ollamaOnline || !model) return;
    setPlanning(true);
    setPlan('');
    setStatus(`Consultando plan UI con ${model}...`);
    try {
      const res = await fetch(apiUrl('/api/ui-automation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, action: 'plan', goal: goal.trim(), model }),
      });
      const data = await res.json();
      if (data.success) {
        setPlan(data.plan || '');
        if (Array.isArray(data.elements)) setElements(data.elements);
        setStatus(`Plan generado por ${data.provider || model}.`);
      } else {
        setStatus(data.error || 'No se pudo generar el plan UI.');
      }
    } catch { setStatus('Error de red generando plan UI.'); }
    finally { setPlanning(false); }
  };

  return (
    <div className={`rounded-xl border p-4 sm:p-5 space-y-3 ${cardCls} shadow-sm`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <ScanEye size={17} />
          <div>
            <h3 className="text-sm font-semibold">Automatización UI (UIAutomator + IA Local)</h3>
            <p className={`text-xs ${mutedCls}`}>Inspecciona el árbol real de pantalla, navega o pide un plan paso a paso al modelo local.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="secondary" size="sm" icon={<ArrowLeft size={12} />} disabled={!canUse} onClick={() => runAction({ action: 'key', key: 'BACK' }, 'Atrás')}>Atrás</Button>
          <Button variant="secondary" size="sm" icon={<Home size={12} />} disabled={!canUse} onClick={() => runAction({ action: 'key', key: 'HOME' }, 'Inicio')}>Inicio</Button>
          <Button variant="secondary" size="sm" icon={<Layers size={12} />} disabled={!canUse} onClick={() => runAction({ action: 'key', key: 'APP_SWITCH' }, 'Recientes')}>Recientes</Button>
          <Button variant="primary" size="sm" icon={loading ? <Loader2 size={12} className="animate-spin" /> : <ScanEye size={12} />} disabled={!canUse || loading} onClick={inspectScreen}>
            {loading ? 'Leyendo UI...' : 'Inspeccionar pantalla'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Objetivo UI para planificar con IA local (ej: abrir Ajustes de Wi-Fi)..."
          className={`flex-1 min-w-[220px] rounded-lg border px-3 py-1.5 text-xs outline-none ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
        />
        <Button variant="secondary" size="sm" icon={planning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} disabled={!canUse || !ollamaOnline || !goal.trim() || planning} onClick={generatePlan}>
          {planning ? 'Planificando...' : 'Planificar con IA'}
        </Button>
      </div>

      {status && <p className={`text-xs font-mono ${mutedCls}`}>{status}</p>}

      {plan && (
        <pre className={`rounded-lg border p-3 text-xs whitespace-pre-wrap font-mono ${dark ? 'bg-zinc-900/70 border-zinc-800 text-zinc-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
          {plan}
        </pre>
      )}

      {elements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pt-1">
          {elements.map((el, i) => (
            <button
              key={`${el.label}-${el.x}-${el.y}-${i}`}
              type="button"
              onClick={() => runAction({ action: 'tap', x: el.x, y: el.y }, `Tap "${el.label}" (${el.x},${el.y})`)}
              title={`${el.resourceId || el.label} · (${el.x}, ${el.y})`}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-mono transition-colors ${
                dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800' : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
              }`}
            >
              <MousePointerClick size={11} />
              <span className="max-w-[160px] truncate">{el.label}</span>
              <span className={mutedCls}>({el.x},{el.y})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
