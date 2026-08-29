'use client';

import { Shield, ShieldAlert, AlertTriangle, Trash2 } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { useActions } from '@/hooks/useActions';
import { ViewShell } from '@/components/ViewShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DeviceInfo } from './types';

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
      onClick={() => setCurarSubTab(id)}
      className={`pb-2 px-3 font-bold text-[11px] border-b-2 transition-all flex items-center gap-1.5 ${
        curarSubTab === id
          ? 'border-brand text-brand-light'
          : `border-transparent ${dark ? 'text-text-secondary hover:text-text-primary' : 'text-slate-400 hover:text-slate-700'}`
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <ViewShell navId="curar">
      <div className="mx-auto w-full min-w-0 max-w-4xl">
        {/* Sub-tab selection */}
        <div className={`custom-scrollbar flex gap-4 overflow-x-auto border-b ${dark ? 'border-white/10' : 'border-slate-200'} mb-3`}>
          {tab('antivirus', <ShieldAlert size={12} />, 'Análisis')}
          {tab('screenshot', <Shield size={12} />, 'Capturas')}
        </div>

        {curarSubTab === 'antivirus' ? <AntivirusPanel propAddLog={propAddLog} /> : <ScreenshotPanel />}
      </div>
    </ViewShell>
  );
}

// ── Antivirus Sub-panel ────────────────────────────────────────────

function AntivirusPanel({ propAddLog }: { propAddLog?: (msg: string, type?: 'info' | 'success' | 'error') => void }) {
  const { t, dark } = useTheme();
  const appsList = useAppStore((s) => s.appsList);
  const appsLoading = useAppStore((s) => s.appsLoading);
  const device = useAppStore((s) => s.device);
  const activeSerial = useAppStore((s) => s.activeSerial);
  const storeAddLog = useAppStore((s) => s.addLog);
  const addLog = propAddLog || storeAddLog;
  const { fetchApps } = useActions();

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-semantic-danger/10 flex items-center justify-center text-red-400 shadow-inner"><ShieldAlert size={24} /></div>
          <div>
            <h2 className="text-lg font-bold">Análisis de seguridad</h2>
            <p className={`text-sm ${t.textMuted} mt-1`}>Revisa aplicaciones instaladas y señala coincidencias con indicadores locales de riesgo.</p>
          </div>
        </div>
      </Card>

      {appsList.length === 0 ? (
        <Card className="text-center">
          <AlertTriangle size={36} className="mx-auto mb-3 text-amber-500 opacity-60" />
          <h3 className="font-bold text-sm mb-1">Se requiere lista de aplicaciones</h3>
          <p className={`text-xs ${t.textMuted} mb-6 max-w-sm mx-auto`}>Carga la lista de aplicaciones instaladas para compararla con los indicadores disponibles.</p>
          <Button
            icon={<Shield size={14} />}
            onClick={fetchApps}
            disabled={appsLoading || !device?.connected}
          >
            {appsLoading ? 'Cargando aplicaciones...' : 'Analizar aplicaciones'}
          </Button>
        </Card>
      ) : (() => {
        const malwareApps = appsList.filter(app => app.isMalware);
        if (malwareApps.length === 0) {
          return (
            <Card className="bg-semantic-success/5 border-semantic-success/20">
              <div className="w-14 h-14 rounded-full bg-semantic-success/10 border border-semantic-success/20 flex items-center justify-center text-emerald-400 mx-auto mb-4">
                <Shield size={28} />
              </div>
              <h3 className="font-bold text-emerald-400 text-sm mb-1 text-center">Sin coincidencias conocidas</h3>
              <p className={`text-xs ${t.textSub} mb-4 max-w-sm mx-auto text-center`}>No se encontraron coincidencias con los indicadores locales disponibles. Este resultado no sustituye un análisis de seguridad especializado.</p>
              <div className={`grid grid-cols-2 gap-2 text-[10px] text-left max-w-xs mx-auto p-3 rounded-xl font-semibold ${dark ? 'bg-white/[0.03] border border-white/5 text-white/60' : 'bg-slate-50 border border-slate-200 text-slate-500'}`}>
                <div>Anubis / Cerberus: sin coincidencias</div>
                <div>Pegasus / Hermit: sin coincidencias</div>
                <div>TeaBot / FluBot: sin coincidencias</div>
                <div>SpyNote / RAT: sin coincidencias</div>
                <div>HiddenAds: sin coincidencias</div>
                <div>Svpeng: sin coincidencias</div>
              </div>
            </Card>
          );
        }

        return (
          <>
            <Card className="bg-semantic-danger/5 border-semantic-danger/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-red-400" size={20} />
                  <div>
                    <p className="text-xs font-bold text-red-400">Aplicaciones sospechosas detectadas</p>
                    <p className={`text-[10px] ${dark ? 'text-white/70' : 'text-slate-500'}`}>Se encontraron {malwareApps.length} aplicaciones que coinciden con indicadores de riesgo.</p>
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    if (!confirm(`¿Estás seguro que deseas desinstalar y depurar las ${malwareApps.length} amenazas de forma automática?`)) return;
                    addLog('Iniciando limpieza masiva de amenazas...');
                    for (const app of malwareApps) {
                      addLog(`Depurando y eliminando: ${app.packageName}...`);
                      try {
                        await fetch('/api/apps', {
                          method: 'POST',
                          body: JSON.stringify({ action: 'uninstall', packageName: app.packageName, serial: activeSerial }),
                          headers: { 'Content-Type': 'application/json' },
                        });
                      } catch { /* continue */ }
                    }
                    addLog('✓ Limpieza masiva completada.');
                    fetchApps();
                  }}
                >
                  Desinstalar seleccionadas
                </Button>
              </div>
            </Card>

            <div className="flex flex-col gap-3">
              {malwareApps.map((app, idx) => (
                <Card key={app.packageName ? `${app.packageName}-${idx}` : `malware-${idx}`}>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-semantic-danger/10 border border-semantic-danger/20 flex items-center justify-center text-red-400 shadow-inner">
                          <AlertTriangle size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-text-primary">{app.name || app.packageName}</h4>
                          <p className="text-[10px] text-text-tertiary font-mono mt-0.5">{app.packageName}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Badge tone="danger" size="sm">{(app.threatSeverity || 'ALERTA').toUpperCase()}</Badge>
                            <span className="text-[10px] font-semibold text-red-400">{app.threatName}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`p-3.5 rounded-xl text-[11px] ${dark ? 'bg-black/40 border border-white/5 text-gray-400' : 'bg-slate-50 border border-slate-200 text-slate-600'}`}>
                      <p className={`font-bold ${dark ? 'text-white/80' : 'text-slate-800'}`}>Indicador detectado:</p>
                      <p className="mt-1 leading-relaxed">
                        {(app.threatName || '').includes('Bancario') && 'Captura contraseñas de cuentas, intercepta tokens SMS de seguridad (2FA) y superpone ventanas sobre apps de banco.'}
                        {(app.threatName || '').includes('Spyware') && 'Rastrea ubicación GPS en tiempo real, lee registros de llamadas, espía mensajes privados de chat y puede activar cámara.'}
                        {(app.threatName || '').includes('RAT') && 'Permite a un atacante controlar tu celular a distancia de forma invisible, ver archivos, realizar capturas de pantalla y espiar chats.'}
                        {(app.threatName || '').includes('Adware') && 'Abre anuncios de publicidad intrusivos en tu pantalla, gasta batería y datos en segundo plano instalando apps basura.'}
                        {(app.threatName || '').includes('Ransomware') && 'Bloquea el acceso a tus archivos o cambia el PIN de bloqueo exigiendo un pago para recuperarlo.'}
                        {(app.threatName || '').includes('Botnet') && 'Une tu celular a una red de spam que descarga archivos maliciosos ocultos de forma silenciosa.'}
                      </p>
                    </div>

                    <div className={`flex flex-wrap items-center gap-2 pt-3 border-t ${dark ? 'border-white/5' : 'border-slate-200'}`}>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Trash2 size={12} />}
                        onClick={async () => {
                          if (!confirm(`¿Deseas desinstalar completamente la amenaza ${app.packageName}?`)) return;
                          addLog(`Eliminando amenaza: ${app.packageName}...`);
                          try {
                            const r = await fetch('/api/apps', {
                              method: 'POST',
                              body: JSON.stringify({ action: 'uninstall', packageName: app.packageName, serial: activeSerial }),
                              headers: { 'Content-Type': 'application/json' },
                            });
                            const d = await r.json();
                            if (d.success) { addLog(`✓ Amenaza ${app.packageName} desinstalada.`); fetchApps(); }
                            else { addLog(`✗ Error al desinstalar: ${d.error}`); }
                          } catch { addLog(`✗ Error de red al desinstalar ${app.packageName}`); }
                        }}
                      >
                        Desinstalar aplicación
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Shield size={12} />}
                        onClick={async () => {
                          addLog(`Forzando detención del proceso: ${app.packageName}...`);
                          try {
                            const r = await fetch('/api/apps', {
                              method: 'POST',
                              body: JSON.stringify({ action: 'force_stop', packageName: app.packageName, serial: activeSerial }),
                              headers: { 'Content-Type': 'application/json' },
                            });
                            const d = await r.json();
                            if (d.success) addLog(`✓ Proceso de ${app.packageName} detenido.`);
                            else addLog(`✗ Error al forzar detención: ${d.error}`);
                          } catch { addLog(`✗ Error de red al detener ${app.packageName}`); }
                        }}
                      >
                        Forzar detención
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Trash2 size={12} />}
                        onClick={async () => {
                          if (!confirm(`¿Deseas borrar por completo todos los datos y caché de ${app.packageName}?`)) return;
                          addLog(`Purgando datos de la amenaza: ${app.packageName}...`);
                          try {
                            const r = await fetch('/api/apps', {
                              method: 'POST',
                              body: JSON.stringify({ action: 'clear_data', packageName: app.packageName, serial: activeSerial }),
                              headers: { 'Content-Type': 'application/json' },
                            });
                            const d = await r.json();
                            if (d.success) addLog(`✓ Almacenamiento de ${app.packageName} restablecido a cero.`);
                            else addLog(`✗ Error al borrar datos: ${d.error}`);
                          } catch { addLog(`✗ Error de red al borrar datos de ${app.packageName}`); }
                        }}
                      >
                        Borrar datos
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ── Screenshot Compatibility Sub-panel ─────────────────────────────

function ScreenshotPanel() {
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
          <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center text-brand-light shadow-inner"><Shield size={24} /></div>
          <div>
            <h2 className="text-lg font-bold">Compatibilidad con capturas de pantalla</h2>
            <p className={`text-sm ${t.textMuted} mt-1`}>Prepara una variante de la aplicación para comprobar compatibilidad con capturas. Requiere una aplicación compatible.</p>
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
              ? dark ? 'bg-brand/10 border-brand/30' : 'bg-emerald-50 border-emerald-200'
              : dark ? 'bg-white/[0.03] border-white/5' : 'bg-slate-50 border-slate-200'
          }`}>
            <input
              type="checkbox"
              checked={isCloneMode}
              onChange={(e) => setIsCloneMode(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
            />
            <div>
              <span className={`text-sm font-bold ${t.text}`}>Instalar en perfil de trabajo</span>
              <p className={`text-[10px] ${t.textMuted} mt-0.5`}>Conserva la aplicación original e instala la variante en un perfil de trabajo separado.</p>
            </div>
          </label>

          {!isCloneMode && (
            <p className={`text-[11px] ${t.textMuted}`}>
              ⚠️ <strong>Reemplazo directo:</strong> Se desinstalará la app original. Perderás tus datos locales (cuentas, descargas).
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
}