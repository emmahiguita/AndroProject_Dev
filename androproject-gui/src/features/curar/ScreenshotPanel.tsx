// ============================================================================
// ARCHIVO: ScreenshotPanel.tsx
// QUÉ HACE: Subpanel para preparar compatibilidad de capturas de pantalla en
//           apps Android (clonado a perfil de trabajo o reemplazo directo).
// CÓMO FUNCIONA: Delega el proceso real a `useActions().startPatching(...)`
//           y muestra el log en tiempo real.
// POR QUÉ: Extraído de `CurarView.tsx` para cumplir SRP y < 200 líneas.
// ============================================================================
'use client';

import React from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { useActions } from '@/hooks/useActions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export const ScreenshotPanel: React.FC = () => {
  const { t, dark } = useTheme();
  const patchPackage = useAppStore((s) => s.patchPackage);
  const setPatchPackage = useAppStore((s) => s.setPatchPackage);
  const isPatching = useAppStore((s) => s.isPatching);
  const isCloneMode = useAppStore((s) => s.isCloneMode);
  const setIsCloneMode = useAppStore((s) => s.setIsCloneMode);
  const patchLogs = useAppStore((s) => s.patchLogs);
  const device = useAppStore((s) => s.device);
  const { startPatching } = useActions();

  const handlePatch = async () => {
    const setIsPatching = useAppStore.getState().setIsPatching;
    const setPatchLogs = useAppStore.getState().setPatchLogs;
    await startPatching(patchPackage, setIsPatching, setPatchLogs);
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center text-brand-light shadow-inner">
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Compatibilidad con capturas de pantalla</h2>
            <p className={`text-sm ${t.textMuted} mt-1`}>
              Prepara una variante de la aplicación para comprobar compatibilidad con capturas.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <Input
            label="Nombre del paquete"
            placeholder="ej. com.badoo.mobile"
            value={patchPackage}
            onChange={(e) => setPatchPackage(e.target.value)}
            icon={<Shield size={14} />}
          />
          <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            isCloneMode
              ? dark ? 'bg-brand/10 border-brand/30' : 'bg-zinc-100 border-zinc-300'
              : dark ? 'bg-white/[0.03] border-white/5' : 'bg-slate-50 border-slate-200'
          }`}>
            <input
              type="checkbox"
              checked={isCloneMode}
              onChange={(e) => setIsCloneMode(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-500 cursor-pointer accent-zinc-600"
            />
            <div>
              <span className={`text-sm font-bold ${t.text}`}>Instalar en perfil de trabajo</span>
              <p className={`text-[10px] ${t.textMuted} mt-0.5`}>Conserva la aplicación original en un perfil separado.</p>
            </div>
          </label>
          {!isCloneMode && (
            <p className={`text-[11px] ${t.textMuted} flex items-center gap-1.5`}>
              <AlertTriangle size={13} className="text-amber-500 shrink-0" />
              <span><strong>Reemplazo directo:</strong> Se desinstalará la app original.</span>
            </p>
          )}
          <Button
            fullWidth
            size="lg"
            icon={<Shield size={18} className={isPatching ? 'animate-pulse' : ''} />}
            disabled={!patchPackage || isPatching || !device}
            onClick={handlePatch}
          >
            {isPatching ? 'Procesando aplicación...' : 'Preparar aplicación'}
          </Button>
        </div>
      </Card>

      {patchLogs && (
        <Card>
          <p className={`text-2xs ${t.textSub} uppercase tracking-widest font-bold mb-2`}>Registro del proceso</p>
          <div className={`font-mono text-[11px] h-48 overflow-y-auto whitespace-pre-wrap custom-scrollbar ${dark ? 'text-emerald-400/80' : 'text-emerald-700'}`}>
            {patchLogs}
          </div>
        </Card>
      )}
    </div>
  );
};
