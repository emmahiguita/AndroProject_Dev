// ============================================================================
// ARCHIVO: FlasherBootloaderPanel.tsx
// QUÉ HACE: Panel de diagnóstico y control del gestor de arranque (Bootloader,
//           Slot A/B, Estado Root, Esquema A/B, VBMeta, OEM Unlock y reinicios).
// CÓMO FUNCIONA: Muestra las 8 propiedades reales devueltas por `/api/flash`
//           (`check_state`) y expone controles para modos ADB, Fastboot,
//           Recovery y Sideload sin dejar estados sin acciones.
// POR QUÉ: Eliminar propiedades huérfanas (`root_status`, `ab_device`) y cubrir
//          todos los modos de arranque en < 200 líneas (SRP).
// ============================================================================
'use client';

import React from 'react';
import { Zap, RefreshCw, Shield, RotateCcw, Lock, Unlock, ExternalLink, Trash2 } from 'lucide-react';

interface FlasherBootloaderPanelProps {
  dark: boolean;
  flashState: string;
  flashInfo: Record<string, string>;
  busyAction: string | null;
  cmdResult: { text: string; isError: boolean } | null;
  onDetectState: () => void;
  onRunAction: (action: string, confirmMsg?: string, extra?: Record<string, string>) => void;
}

export const FlasherBootloaderPanel: React.FC<FlasherBootloaderPanelProps> = ({
  dark, flashState, flashInfo, busyAction, cmdResult, onDetectState, onRunAction,
}) => {
  const cardCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-300 text-slate-900 shadow-sm';
  const btnCls = `px-2.5 py-1.5 rounded border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer ${
    dark ? 'bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800' : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
  }`;

  const stateLabel =
    flashState === 'fastboot' ? 'FASTBOOT (Listo para flashear .img o Boot en RAM)'
    : flashState === 'adb' ? 'ANDROID ADB (En línea — listo para OEM Unlock o reinicio a Bootloader)'
    : flashState === 'recovery' ? 'RECOVERY (Listo para ADB Sideload o reinicio)'
    : flashState === 'sideload' ? 'ADB SIDELOAD (Esperando paquete .zip)'
    : 'SIN DISPOSITIVO DETECTADO (Verifica conexión USB o modo Fastboot)';

  const stateDot =
    flashState === 'adb' || flashState === 'fastboot' ? 'bg-emerald-500'
    : flashState === 'recovery' || flashState === 'sideload' ? 'bg-amber-500' : 'bg-zinc-500';

  const cells: [string, string][] = [
    ['Producto', flashInfo.product || '--'],
    ['Serial', flashInfo.serialno || '--'],
    ['Slot Activo', (flashInfo['current-slot'] || '--').toUpperCase()],
    ['Esquema', flashInfo.ab_device || (flashInfo['max-download-size'] ? `Max ${flashInfo['max-download-size']}` : '--')],
    ['Bootloader', flashInfo.unlocked === 'yes' ? 'Desbloqueado' : flashInfo.unlocked === 'no' ? 'Bloqueado' : '--'],
    ['OEM Unlock', flashInfo.oem_allowed || (flashInfo.secure ? `Secure: ${flashInfo.secure}` : '--')],
    ['VBMeta / AVB', flashInfo.vbmeta || flashInfo.verifiedboot || '--'],
    ['Estado Root', flashInfo.root_status || '--'],
  ];

  return (
    <div className={`rounded-lg border p-3.5 space-y-3 ${cardCls}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded border flex items-center justify-center shrink-0 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
            <Zap size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold">Gestor de Arranque, Bootloader, Root y Fastboot</h2>
            <p className={`text-[11px] ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Inspección real de Bootloader, Slots A/B, Root (su/Magisk), OEM Unlock y flasheo de particiones
            </p>
          </div>
        </div>
        <button type="button" onClick={onDetectState} disabled={busyAction !== null} className={btnCls}>
          <RefreshCw size={12} className={busyAction === 'check_state' ? 'animate-spin' : ''} /><span>Detectar estado</span>
        </button>
      </div>

      {/* Tabla técnica de 8 variables del bootloader y sistema */}
      <div className={`rounded border p-2.5 space-y-2 ${dark ? 'bg-zinc-900/70 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${stateDot}`} />
          <span className="text-xs font-mono font-bold">{stateLabel}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1.5 border-t border-zinc-800/40 text-[11px] font-mono">
          {cells.map(([label, val]) => (
            <div key={label}>
              <span className={`block text-[10px] uppercase ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>{label}</span>
              <strong className="truncate block">{val}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Controles reales según el modo actual */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Shield size={13} className={dark ? 'text-zinc-400' : 'text-slate-600'} />
          <span className="text-[11px] font-bold uppercase tracking-wider">Acciones de Bootloader, OEM y Reinicio</span>
        </div>

        {flashState === 'adb' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
            <button type="button" onClick={() => onRunAction('oem_unlock_check')} disabled={busyAction !== null} className={btnCls}><Shield size={12} /><span>Verificar OEM</span></button>
            <button type="button" onClick={() => onRunAction('oem_unlock_enable', '¿Intentar habilitar OEM Unlock vía ADB?')} disabled={busyAction !== null} className={btnCls}><Unlock size={12} /><span>Habilitar OEM</span></button>
            <button type="button" onClick={() => onRunAction('open_oem_settings')} disabled={busyAction !== null} className={btnCls}><ExternalLink size={12} /><span>Abrir OEM Móvil</span></button>
            <button type="button" onClick={() => onRunAction('reboot_bootloader', '¿Reiniciar dispositivo en modo Fastboot / Bootloader?')} disabled={busyAction !== null} className={btnCls}><RotateCcw size={12} /><span>Ir a Fastboot</span></button>
            <button type="button" onClick={() => onRunAction('reboot_recovery', '¿Reiniciar dispositivo en modo Recovery?')} disabled={busyAction !== null} className={btnCls}><RotateCcw size={12} /><span>Ir a Recovery</span></button>
            <button type="button" onClick={() => onRunAction('reboot_fastbootd', '¿Reiniciar en modo Fastbootd (Userspace)?')} disabled={busyAction !== null} className={btnCls}><RotateCcw size={12} /><span>Ir a Fastbootd</span></button>
          </div>
        )}

        {flashState === 'fastboot' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
            <button type="button" onClick={() => onRunAction('fastboot_unlock', 'ADVERTENCIA: Desbloquear el bootloader borrará todos los datos del usuario. ¿Continuar?')} disabled={busyAction !== null} className={btnCls}><Unlock size={12} /><span>Unlock OEM</span></button>
            <button type="button" onClick={() => onRunAction('fastboot_lock', '¿Cerrar el bootloader (fastboot flashing lock)? Requiere ROM stock.')} disabled={busyAction !== null} className={btnCls}><Lock size={12} /><span>Lock OEM</span></button>
            <button type="button" onClick={() => onRunAction('fastboot_set_slot', '¿Activar el slot A para el próximo arranque?', { slot: 'a' })} disabled={busyAction !== null} className={btnCls}><span>Activar Slot A</span></button>
            <button type="button" onClick={() => onRunAction('fastboot_set_slot', '¿Activar el slot B para el próximo arranque?', { slot: 'b' })} disabled={busyAction !== null} className={btnCls}><span>Activar Slot B</span></button>
            <button type="button" onClick={() => onRunAction('fastboot_oem_device_info')} disabled={busyAction !== null} className={btnCls}><span>Info OEM</span></button>
            <button type="button" onClick={() => onRunAction('fastboot_erase_partition', '¿Formatear partición cache vía Fastboot?', { partition: 'cache' })} disabled={busyAction !== null} className={btnCls}><Trash2 size={12} /><span>Borrar Cache</span></button>
            <button type="button" onClick={() => onRunAction('fastboot_reboot')} disabled={busyAction !== null} className={btnCls}><RotateCcw size={12} /><span>Reiniciar</span></button>
          </div>
        )}

        {(flashState === 'recovery' || flashState === 'sideload' || flashState === 'unknown') && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button type="button" onClick={() => onRunAction('reboot_system')} disabled={busyAction !== null} className={btnCls}><RotateCcw size={12} /><span>Reiniciar a Android (ADB)</span></button>
            <button type="button" onClick={() => onRunAction('reboot_bootloader')} disabled={busyAction !== null} className={btnCls}><RotateCcw size={12} /><span>Ir a Bootloader (ADB)</span></button>
            <button type="button" onClick={() => onRunAction('fastboot_oem_device_info')} disabled={busyAction !== null} className={btnCls}><Shield size={12} /><span>Consultar Info Fastboot</span></button>
            <button type="button" onClick={() => onRunAction('fastboot_reboot')} disabled={busyAction !== null} className={btnCls}><RotateCcw size={12} /><span>Reiniciar desde Fastboot</span></button>
          </div>
        )}
      </div>

      {cmdResult && (
        <div
          className={`rounded border px-3 py-2 text-xs font-mono whitespace-pre-wrap ${
            cmdResult.isError
              ? dark ? 'bg-zinc-900 border-zinc-800 text-red-300' : 'bg-slate-100 border-slate-300 text-red-800'
              : dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-300 text-slate-800'
          }`}
        >
          {cmdResult.text}
        </div>
      )}
    </div>
  );
};
