'use client';

import { Zap, RefreshCw, Shield, AlertTriangle, Download } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { Button } from '@/components/ui/Button';

// ── Partition definitions (specific to flasher view) ────────────────
const PARTITIONS = [
  { id: 'boot',        label: 'Arranque',        desc: 'Kernel y arranque del sistema', critical: false },
  { id: 'recovery',    label: 'Recuperación',    desc: 'Sistema de recuperación', critical: false },
  { id: 'system',      label: 'Sistema',      desc: 'Sistema operativo Android', critical: false },
  { id: 'vendor',      label: 'Proveedor',      desc: 'Drivers del fabricante', critical: false },
  { id: 'vendor_boot', label: 'Arranque Proveedor', desc: 'Arranque del fabricante (Android 12+)', critical: false },
  { id: 'init_boot',   label: 'Inicio Arranque',   desc: 'Inicialización de arranque (Android 13+)', critical: false },
  { id: 'dtbo',        label: 'DTBO',        desc: 'Device Tree Overlay', critical: false },
  { id: 'vbmeta',      label: 'VBMeta',      desc: 'Verificación de arranque', critical: false },
  { id: 'super',       label: 'Super',       desc: 'Partición dinámica (A/B)', critical: false },
  { id: 'product',     label: 'Producto',     desc: 'Apps del fabricante', critical: false },
  { id: 'userdata',    label: 'Datos usuario',    desc: 'Datos de usuario (PELIGRO)', critical: false },
  { id: 'boot_a',      label: 'Arranque A',      desc: 'Slot A - Kernel', critical: false },
  { id: 'boot_b',      label: 'Arranque B',      desc: 'Slot B - Kernel', critical: false },
  { id: 'recovery_a',  label: 'Recuperación A',  desc: 'Slot A - Recuperación', critical: false },
  { id: 'recovery_b',  label: 'Recuperación B',  desc: 'Slot B - Recuperación', critical: false },
  { id: 'bootloader',  label: 'Gestor Arranque',  desc: 'CRÍTICO: gestor de arranque — brick si falla', critical: true },
  { id: 'radio',       label: 'Radio / Módem', desc: 'CRÍTICO: firmware de radio/baseband', critical: true },
  { id: 'modem',       label: 'Módem',     desc: 'CRÍTICO: partición del módem', critical: true },
  { id: 'persist',     label: 'Persistencia',   desc: 'CRÍTICO: calibración de sensores (IMEI, MAC)', critical: true },
  { id: 'misc',        label: 'Miscelánea',      desc: 'CRÍTICO: configuración de arranque', critical: true },
  { id: 'logo',        label: 'Logo',        desc: 'Logo de arranque (splash)', critical: false },
];

import { DeviceInfo } from './types';

interface FlasherViewProps {
  device?: DeviceInfo | null;
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function FlasherView({ addLog: propAddLog }: FlasherViewProps = {}) {
  const { t, dark } = useTheme();
  const flashState = useAppStore((s) => s.flashState);
  const setFlashState = useAppStore((s) => s.setFlashState);
  const flashInfo = useAppStore((s) => s.flashInfo);
  const setFlashInfo = useAppStore((s) => s.setFlashInfo);
  const selectedPartition = useAppStore((s) => s.selectedPartition);
  const setSelectedPartition = useAppStore((s) => s.setSelectedPartition);
  const flashFile = useAppStore((s) => s.flashFile);
  const setFlashFile = useAppStore((s) => s.setFlashFile);
  const flashing = useAppStore((s) => s.flashing);
  const setFlashing = useAppStore((s) => s.setFlashing);
  const flashProgress = useAppStore((s) => s.flashProgress);
  const setFlashProgress = useAppStore((s) => s.setFlashProgress);
  const activeSerial = useAppStore((s) => s.activeSerial);
  const storeAddLog = useAppStore((s) => s.addLog);
  const addLog = propAddLog || storeAddLog;
  return (
    <ViewShell navId="flasher">
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-5">

        {/* Header */}
        <div className={`${dark ? 'bg-zinc-950 border border-zinc-800' : `${t.panel} border ${t.border}`} rounded-xl p-6`}>
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-12 h-12 rounded-xl border ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'} flex items-center justify-center`}>
              <Zap size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Flashear ROM</h2>
              <p className={`text-xs ${t.textMuted} mt-0.5`}>Instala sistemas operativos, kernels y particiones vía Fastboot / Sideload.</p>
            </div>
          </div>

          {/* Device State Detector */}
          <div className={`${dark ? 'bg-zinc-900/60 border border-zinc-800' : 'bg-slate-50 border border-slate-200'} rounded-xl p-4 mb-5`}>
            <div className="flex items-center justify-between mb-3">
              <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold`}>Estado del dispositivo</p>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={12} />}
                onClick={async () => {
                  try {
                    const fd = new FormData();
                    fd.append('action', 'check_state');
                    if (activeSerial) fd.append('serial', activeSerial);
                    const r = await fetch('/api/flash', { method: 'POST', body: fd });
                    const d = await r.json();
                    setFlashState(d.state);
                    setFlashInfo(d.deviceInfo || {});
                    addLog(`Estado Flash: ${d.state}`);
                  } catch { addLog('Error al verificar estado'); }
                }}
              >
                Detectar
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <div className={`w-2.5 h-2.5 rounded-full ${
                flashState === 'adb' ? 'bg-emerald-500' :
                flashState === 'fastboot' || flashState === 'recovery' || flashState === 'sideload' ? (dark ? 'bg-zinc-200' : 'bg-slate-800') :
                flashState === 'hardware_only' ? 'bg-zinc-400' :
                'bg-zinc-600'
              }`} />
              <div>
                <p className="text-sm font-bold">
                  {flashState === 'fastboot' ? 'Modo Fastboot — listo para flashear' :
                   flashState === 'adb' ? 'Android activo — reinicia en bootloader para flashear' :
                   flashState === 'recovery' ? 'Modo recovery — Sideload disponible' :
                   flashState === 'sideload' ? 'Modo sideload — listo para recibir el archivo ZIP' :
                   flashState === 'hardware_only' ? 'Hardware detectado — modo de bajo nivel' :
                   'Sin dispositivo detectado'}
                </p>
                {flashInfo.product && <p className={`text-xs ${t.textMuted} mt-1`}>Producto: {flashInfo.product} | Serial: {flashInfo.serialno || '--'} | Desbloqueado: {flashInfo.unlocked || '--'}</p>}
              </div>
            </div>
          </div>

          {flashState === 'hardware_only' && (
            <div className={`flex items-start gap-3 ${dark ? 'bg-zinc-900 border border-zinc-700' : 'bg-slate-100 border border-slate-300'} rounded-xl p-3.5 mb-5`}>
              <AlertTriangle size={20} className={dark ? 'text-zinc-300 shrink-0 mt-0.5' : 'text-slate-700 shrink-0 mt-0.5'} />
              <div>
                <p className={`text-sm font-bold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>Aviso: Posible falta de Drivers Fastboot</p>
                <p className={`text-xs ${t.textMuted} mt-1`}>
                  Windows detectó la conexión física del dispositivo, pero no puede comunicarse mediante comandos Fastboot.
                  Si tu celular se reinicia solo a los pocos segundos de entrar en la pantalla de Fastboot, se debe a la falta del driver <strong>Android Bootloader Interface</strong> en tu PC. Instálalo desde el Administrador de Dispositivos para poder flashear.
                </p>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className={`flex items-start gap-3 ${dark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'} rounded-xl p-3.5 mb-5`}>
            <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-500">Zona de alto riesgo</p>
              <p className={`text-xs ${t.textMuted} mt-1`}>Flashear una imagen incorrecta puede dejar tu dispositivo inservible (brick). Asegúrate de que el archivo .img sea compatible con tu modelo exacto.</p>
            </div>
          </div>
        </div>

        {/* Bootloader & Unlock Controls */}
        <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <Shield size={20} className="text-orange-500" />
               <p className="text-sm font-bold">Gestor de arranque y desbloqueo</p>
          </div>

          {flashState === 'adb' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-black/10 dark:bg-white/[0.05] p-3 rounded-lg text-xs">
                <span className={t.textMuted}>Comprobar estado OEM Unlock actual:</span>
                <button
                  onClick={async () => {
                    try {
                      const fd = new FormData();
                      fd.append('action', 'oem_unlock_check');
                      if (activeSerial) fd.append('serial', activeSerial);
                      const r = await fetch('/api/flash', { method: 'POST', body: fd });
                      const d = await r.json();
                      if (d.success) {
                        addLog(`OEM Unlock: ${d.unlocked ? 'Permitido' : 'Bloqueado'}`);
                        alert(`Desbloqueo OEM en Ajustes está: ${d.unlocked ? 'PERMITIDO / HABILITADO' : 'BLOQUEADO / DESHABILITADO'}`);
                      } else { addLog(`Error al verificar OEM: ${d.error}`); }
                    } catch { addLog('Error de conexión'); }
                  }}
                  className={`px-3 py-1.5 rounded-lg ${dark ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700' : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border border-zinc-200'} transition-all font-semibold`}
                >
                  Verificar Estado OEM
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (!confirm('¿Deseas habilitar OEM Unlock a nivel de comandos ADB en el dispositivo?')) return;
                    try {
                      const fd = new FormData();
                      fd.append('action', 'oem_unlock_enable');
                      if (activeSerial) fd.append('serial', activeSerial);
                      const r = await fetch('/api/flash', { method: 'POST', body: fd });
                      const d = await r.json();
                      addLog(d.success ? `OEM: ${d.message}` : `Error: ${d.error}`);
                      alert(d.success ? d.message : d.error);
                    } catch { addLog('Error de conexión'); }
                  }}
                  className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 text-xs font-semibold transition-all shadow-sm"
                >
                  Habilitar Desbloqueo OEM
                </button>
                <button
                  onClick={async () => {
                    try {
                      const fd = new FormData();
                      fd.append('action', 'reboot_bootloader');
                      if (activeSerial) fd.append('serial', activeSerial);
                      const r = await fetch('/api/flash', { method: 'POST', body: fd });
                      const d = await r.json();
                      addLog(d.success ? `Reinicio: ${d.message}` : `Error: ${d.error}`);
                    } catch { addLog('Error de conexión'); }
                  }}
                  className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 text-xs font-semibold transition-all shadow-sm"
                >
                  Reiniciar a Bootloader (Fastboot)
                </button>
              </div>
            </div>
          )}

          {flashState === 'fastboot' && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (!confirm('ADVERTENCIA: Intentar desbloquear el bootloader formateará tu celular de fábrica por seguridad. ¿Deseas ejecutar "fastboot flashing unlock"?')) return;
                    try {
                      const fd = new FormData();
                      fd.append('action', 'fastboot_unlock');
                      if (activeSerial) fd.append('serial', activeSerial);
                      const r = await fetch('/api/flash', { method: 'POST', body: fd });
                      const d = await r.json();
                      addLog(d.success ? `Desbloqueo: ${d.message}` : `Error: ${d.error}`);
                      alert(d.success ? `Respuesta: ${d.message}` : `Error: ${d.error}`);
                    } catch { addLog('Error de conexión'); }
                  }}
                  className="flex-1 py-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all shadow-sm"
                >
                  Desbloquear bootloader
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('¿Deseas cerrar el bootloader ejecutando "fastboot flashing lock"? Asegúrate de tener el sistema 100% stock o el celular podría dañarse.')) return;
                    try {
                      const fd = new FormData();
                      fd.append('action', 'fastboot_lock');
                      if (activeSerial) fd.append('serial', activeSerial);
                      const r = await fetch('/api/flash', { method: 'POST', body: fd });
                      const d = await r.json();
                      addLog(d.success ? `Bloqueo: ${d.message}` : `Error: ${d.error}`);
                      alert(d.success ? `Respuesta: ${d.message}` : `Error: ${d.error}`);
                    } catch { addLog('Error de conexión'); }
                  }}
                  className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-all shadow-sm"
                >
                  Bloquear bootloader
                </button>
              </div>
              <button
                onClick={async () => {
                  try {
                    const fd = new FormData();
                    fd.append('action', 'fastboot_oem_device_info');
                    if (activeSerial) fd.append('serial', activeSerial);
                    const r = await fetch('/api/flash', { method: 'POST', body: fd });
                    const d = await r.json();
                    if (d.success) { addLog('Info de dispositivo obtenida con éxito'); alert(d.info); }
                    else { addLog(`Error: ${d.error}`); alert(`Error: ${d.error}`); }
                  } catch { addLog('Error de conexión'); }
                }}
                className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-all shadow-sm"
              >
                Consultar información de seguridad OEM
              </button>
            </div>
          )}

          {flashState !== 'adb' && flashState !== 'fastboot' && (
            <p className={`text-xs italic ${t.textMuted} text-center py-2`}>
              Conecta un dispositivo disponible mediante ADB o Fastboot para habilitar estos controles.
            </p>
          )}
        </div>

        {/* Fastboot Flash Panel */}
        <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <Shield size={20} className="text-orange-500" />
            <p className="text-sm font-bold">Flashear mediante Fastboot (.img)</p>
          </div>

          <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-3`}>Partición de destino</p>
          <div className="grid grid-cols-6 gap-2 mb-4">
            {PARTITIONS.map(p => (
              <button key={p.id}
                onClick={() => setSelectedPartition(p.id)}
                className={`py-2 px-1 rounded-xl text-center transition-all duration-200 border text-[11px] font-bold ${
                  selectedPartition === p.id
                    ? dark ? 'bg-zinc-100 border-zinc-100 text-zinc-950' : 'bg-slate-900 border-slate-900 text-white'
                    : dark ? `bg-zinc-900 border-zinc-800 ${t.textMuted} hover:bg-zinc-800` : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {(() => {
            const selectedPartObj = PARTITIONS.find(p => p.id === selectedPartition);
            return selectedPartObj ? (
              <div className={`mb-4 p-3 rounded-xl flex items-start gap-2.5 text-xs ${dark ? 'bg-zinc-900 border border-zinc-800 text-zinc-300' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold uppercase tracking-wider text-[10px] block mb-0.5">Destino: {selectedPartObj.label}</span>
                  <p className="opacity-90">{selectedPartObj.desc}</p>
                </div>
              </div>
            ) : null;
          })()}

          {/* File Drop */}
          <div className={`border-2 border-dashed ${dark ? 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50' : 'border-slate-300 hover:border-slate-500 hover:bg-slate-50'} transition-all duration-200 rounded-xl p-6 flex flex-col items-center justify-center ${t.bg} relative group`}>
            <input
              type="file"
              accept=".img,.bin,.mbn"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFlashFile(f); addLog(`Archivo seleccionado: ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`); }
              }}
            />
            <div className={`w-12 h-12 rounded-full ${dark ? 'bg-zinc-900 text-zinc-300' : 'bg-slate-100 text-slate-700'} flex items-center justify-center mb-3 transition-transform`}>
              <Download size={22} />
            </div>
            {flashFile ? (
              <>
                <p className={`text-sm font-bold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>{flashFile.name}</p>
                <p className={`text-xs ${t.textMuted} mt-1`}>{(flashFile.size / 1024 / 1024).toFixed(1)} MB — Partición destino: <span className="font-bold">{selectedPartition}</span></p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold transition-colors">Arrastre el archivo .img aquí</p>
                <p className={`text-xs ${t.textMuted} mt-1`}>boot.img, recovery.img, system.img, etc.</p>
              </>
            )}
          </div>

          {/* Flash Button */}
          <Button
            variant="danger"
            size="lg"
            fullWidth
            className="mt-4"
            disabled={!flashFile || flashState !== 'fastboot' || flashing}
            icon={flashing ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
            onClick={async () => {
              if (!flashFile) return;
              const selectedPartObj = PARTITIONS.find(p => p.id === selectedPartition);
              const isCritical = selectedPartObj?.critical === true;
              if (!confirm(`¿Estás SEGURO de flashear "${flashFile.name}" en la partición "${selectedPartition}"? Esto podría dañar el dispositivo.`)) return;
              if (isCritical) {
                if (!confirm(`ADVERTENCIA CRÍTICA\n\n"${selectedPartition}" es una partición de bajo nivel.\n\nFlashearla incorrectamente puede:\n• Dejar el dispositivo inservible (brick)\n• Borrar el IMEI permanentemente\n• Dañar la calibración de sensores\n\n¿Confirmas que sabes lo que haces?`)) return;
                addLog(`Partición crítica: ${selectedPartition}`);
              }
              setFlashing(true);
              setFlashProgress('Enviando imagen al dispositivo...');
              addLog(`Flasheando ${flashFile.name} → ${selectedPartition}...`);
              try {
                const fd = new FormData();
                fd.append('action', 'flash');
                fd.append('file', flashFile);
                fd.append('partition', selectedPartition);
                if (isCritical) fd.append('confirmCritical', 'true');
                if (activeSerial) fd.append('serial', activeSerial);
                const r = await fetch('/api/flash', { method: 'POST', body: fd });
                const d = await r.json();
                addLog(d.success ? `Flash: ${d.message}` : `Error: ${d.error}`);
                setFlashProgress(d.success ? 'Flash completado con éxito' : `Error: ${d.error}`);
              } catch { addLog('Error de conexión'); setFlashProgress('Error de conexión'); }
              finally { setFlashing(false); }
            }}
          >
            {flashing ? flashProgress : 'FLASHEAR PARTICIÓN'}
          </Button>
          {flashState !== 'fastboot' && flashFile && (
            <p className={`text-xs text-center ${t.textMuted} mt-2`}>Requiere que el dispositivo esté en modo Fastboot. Usa el botón &quot;Detectar&quot; de la parte superior.</p>
          )}
        </div>

        {/* Sideload Panel */}
        <div className={`${dark ? 'bg-white/[0.025] border border-white/[0.07]' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <Download size={20} className={dark ? 'text-zinc-300' : 'text-slate-700'} />
            <p className="text-sm font-bold">ADB Sideload (.zip)</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${dark ? 'bg-zinc-900 text-zinc-300 border-zinc-700' : 'bg-slate-100 text-slate-700 border-slate-200'} font-medium`}>Recovery</span>
          </div>
          <p className={`text-xs ${t.textMuted} mb-4`}>Envía un archivo ZIP de Custom ROM o actualización al modo Recovery (TWRP/LineageOS Recovery). El dispositivo debe estar en modo ADB Sideload.</p>
          <div className={`border-2 border-dashed ${dark ? 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50' : 'border-slate-300 hover:border-slate-500 hover:bg-slate-50'} transition-all duration-200 rounded-xl p-6 flex flex-col items-center justify-center ${t.bg} relative group`}>
            <input
              type="file"
              accept=".zip"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (!confirm(`¿Enviar "${f.name}" vía ADB Sideload?`)) return;
                if (flashState !== 'sideload' && flashState !== 'recovery') {
                  addLog(`El dispositivo debe estar en modo Recovery/Sideload. Actual: ${flashState}`);
                  setFlashProgress('Requiere modo Recovery con ADB Sideload activado');
                  try {
                    const fd2 = new FormData();
                    fd2.append('action', 'check_state');
                    if (activeSerial) fd2.append('serial', activeSerial);
                    const r2 = await fetch('/api/flash', { method: 'POST', body: fd2 });
                    const d2 = await r2.json();
                    setFlashState(d2.state);
                    setFlashInfo(d2.deviceInfo || {});
                  } catch (e) { console.error('[Flash] unlock request error:', e); }
                  return;
                }
                setFlashing(true);
                setFlashProgress('Enviando ZIP por sideload...');
                addLog(`Sideload: ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)...`);
                try {
                  const fd = new FormData();
                  fd.append('action', 'sideload');
                  fd.append('file', f);
                  if (activeSerial) fd.append('serial', activeSerial);
                  const r = await fetch('/api/flash', { method: 'POST', body: fd });
                  const d = await r.json();
                  addLog(d.success ? `Sideload: ${d.message}` : `Error: ${d.error}`);
                  setFlashProgress(d.success ? 'Sideload completado' : `Error: ${d.error}`);
                } catch { addLog('Error de conexión'); }
                finally { setFlashing(false); e.target.value = ''; }
              }}
            />
            <div className={`w-12 h-12 rounded-full ${dark ? 'bg-blue-500/10' : 'bg-blue-100'} flex items-center justify-center text-blue-500 mb-3 transition-transform`}>
              <Download size={22} />
            </div>
            <p className="text-sm font-semibold group-hover:text-zinc-100 transition-colors">Suelta un archivo ZIP de ROM</p>
            <p className={`text-xs ${t.textMuted} mt-1`}>lineage-20.0-xxx.zip, twrp-installer.zip, etc.</p>
          </div>
        </div>

        {/* Quick Help */}
        <div className={`${dark ? 'bg-white/[0.03] border border-white/[0.07]' : 'bg-slate-50 border border-slate-200'} rounded-xl p-4`}>
          <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-3`}>Guía rápida</p>
          <div className={`space-y-2.5 text-xs ${t.textMuted}`}>
            <p><span className="font-bold text-orange-500">1.</span> Conecta tu dispositivo por <span className="font-bold">USB</span>.</p>
            <p><span className="font-bold text-orange-500">2.</span> Desde &quot;Herramientas&quot; selecciona <span className="font-bold">&quot;Modo bootloader&quot;</span> o usa <code className={`px-1.5 py-0.5 rounded ${dark ? 'bg-white/10' : 'bg-slate-200'}`}>adb reboot bootloader</code>.</p>
            <p><span className="font-bold text-orange-500">3.</span> Selecciona <span className="font-bold">&quot;Detectar&quot;</span> hasta que aparezca <span className="text-orange-500 font-bold">&quot;Modo Fastboot&quot;</span>.</p>
            <p><span className="font-bold text-orange-500">4.</span> Selecciona la <span className="font-bold">partición destino</span>, arrastra tu <code className={`px-1.5 py-0.5 rounded ${dark ? 'bg-white/10' : 'bg-slate-200'}`}>.img</code> y presiona <span className="font-bold text-orange-500">FLASHEAR</span>.</p>
            <p><span className="font-bold text-blue-500">Sideload:</span> Para Custom ROMs (.zip), entra a <span className="font-bold">Recovery → Apply update → ADB Sideload</span> y arrastra el ZIP.</p>
          </div>
        </div>
      </div>
    </ViewShell>
  );
}
