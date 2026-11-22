// ============================================================================
// ARCHIVO: ScreenshotPanel.tsx
// QUÉ HACE: Subpanel para preparar compatibilidad de capturas de pantalla en
//           apps Android (clonado a perfil de trabajo o reemplazo directo).
// CÓMO FUNCIONA: Delega el proceso real a `useActions().startPatching(...)`
//           y muestra el log en tiempo real con contraste legible monocromo.
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
  const { dark } = useTheme();
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

  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            <Shield size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold">Compatibilidad con capturas de pantalla</h2>
            <p className={`text-xs ${mutedCls} mt-0.5`}>
              Prepara una variante de la aplicación para comprobar compatibilidad con capturas.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-3.5">
          <Input
            label="Nombre del paquete"
            placeholder="ej. com.badoo.mobile"
            value={patchPackage}
            onChange={(e) => setPatchPackage(e.target.value)}
            icon={<Shield size={14} />}
          />
          <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            isCloneMode
              ? dark ? 'bg-zinc-900 border-zinc-700' : 'bg-slate-100 border-slate-300'
              : dark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <input
              type="checkbox"
              checked={isCloneMode}
              onChange={(e) => setIsCloneMode(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-500 cursor-pointer accent-zinc-600"
            />
            <div>
              <span className="text-xs font-bold">Instalar en perfil de trabajo</span>
              <p className={`text-[11px] ${mutedCls} mt-0.5`}>Conserva la aplicación original en un perfil separado.</p>
            </div>
          </label>
          {!isCloneMode && (
            <p className={`text-xs ${mutedCls} flex items-center gap-1.5`}>
              <AlertTriangle size={13} className="shrink-0" />
              <span><strong>Reemplazo directo:</strong> Se desinstalará la app original.</span>
            </p>
          )}
          <Button
            fullWidth
            size="md"
            icon={<Shield size={15} className={isPatching ? 'animate-pulse' : ''} />}
            disabled={!patchPackage || isPatching || !device}
            onClick={handlePatch}
          >
            {isPatching ? 'Procesando aplicación...' : 'Preparar aplicación'}
          </Button>
        </div>
      </Card>

      {patchLogs && (
        <Card>
          <p className={`text-[11px] ${mutedCls} uppercase tracking-wider font-bold mb-2`}>Registro del proceso</p>
          <div className={`font-mono text-xs h-48 overflow-y-auto whitespace-pre-wrap custom-scrollbar ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>
            {patchLogs}
          </div>
        </Card>
      )}
    </div>
  );
};
