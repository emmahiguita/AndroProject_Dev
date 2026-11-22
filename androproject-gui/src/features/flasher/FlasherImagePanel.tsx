// ============================================================================
// ARCHIVO: FlasherImagePanel.tsx
// QUÉ HACE: Paneles compactos de flasheo real de particiones Fastboot (.img)
//           y envío de paquetes OTA / Custom ROM por ADB Sideload (.zip).
// CÓMO FUNCIONA: Permite seleccionar la partición destino del catálogo
//           `PARTITIONS`, adjuntar la imagen binaria local y enviarla por
//           stream HTTP hacia `/api/flash` para ejecución nativa.
// POR QUÉ: Mantener componentes pequeños, organizados en 2 columnas y bajo
//           el límite estricto de 200 líneas (SOLID).
// ============================================================================
'use client';

import React from 'react';
import { Zap, Download, AlertTriangle, RefreshCw, HardDrive } from 'lucide-react';
import { PARTITIONS } from './flasher-partitions';

interface FlasherImagePanelProps {
  dark: boolean;
  flashState: string;
  selectedPartition: string;
  onSelectPartition: (id: string) => void;
  flashFile: File | null;
  onSelectFile: (file: File | null) => void;
  flashing: boolean;
  flashProgress: string;
  onExecuteFlash: () => void;
  onExecuteSideload: (file: File) => void;
}

export const FlasherImagePanel: React.FC<FlasherImagePanelProps> = ({
  dark,
  flashState,
  selectedPartition,
  onSelectPartition,
  flashFile,
  onSelectFile,
  flashing,
  flashProgress,
  onExecuteFlash,
  onExecuteSideload,
}) => {
  const cardCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-300 text-slate-900 shadow-sm';
  const selectedPartObj = PARTITIONS.find((p) => p.id === selectedPartition);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Columna 1: Flashear Partición mediante Fastboot (.img / .bin) */}
      <div className={`rounded-lg border p-3.5 space-y-3 ${cardCls}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive size={14} className={dark ? 'text-zinc-300' : 'text-slate-700'} />
            <h3 className="text-xs font-bold uppercase tracking-wider">Flashear Partición Fastboot (.img)</h3>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
            fastboot flash {selectedPartition}
          </span>
        </div>

        {/* Selector compacto de particiones */}
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1">
          {PARTITIONS.map((p) => {
            const active = selectedPartition === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPartition(p.id)}
                className={`py-1 px-1.5 rounded border text-[10px] font-mono font-semibold truncate transition-colors ${
                  active
                    ? dark ? 'bg-zinc-100 text-zinc-950 border-zinc-100' : 'bg-slate-900 text-white border-slate-900'
                    : p.critical
                    ? dark ? 'bg-zinc-900 border-zinc-700 text-red-300 hover:bg-zinc-800' : 'bg-slate-50 border-slate-300 text-red-700 hover:bg-slate-100'
                    : dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title={p.desc}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        {/* Descripción técnica de la partición seleccionada */}
        {selectedPartObj && (
          <div className={`px-2.5 py-1.5 rounded border text-[11px] flex items-center gap-2 ${
            selectedPartObj.critical
              ? dark ? 'bg-zinc-900/70 border-zinc-700 text-red-300' : 'bg-slate-50 border-slate-300 text-red-800'
              : dark ? 'bg-zinc-900/70 border-zinc-800 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <AlertTriangle size={13} className="shrink-0" />
            <span className="truncate">
              <strong className="font-mono">{selectedPartObj.id}:</strong> {selectedPartObj.desc}
            </span>
          </div>
        )}

        {/* Zona compacta de selección de archivo .img */}
        <label className={`border border-dashed rounded-md p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
          dark ? 'border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
        }`}>
          <input
            type="file"
            accept=".img,.bin,.mbn"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              if (f) onSelectFile(f);
            }}
          />
          <div className="flex items-center gap-2.5 min-w-0">
            <Download size={16} className="shrink-0 opacity-70" />
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">
                {flashFile ? flashFile.name : 'Seleccionar imagen (.img, .bin, .mbn)'}
              </p>
              <p className={`text-[10px] font-mono ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
                {flashFile
                  ? `${(flashFile.size / 1048576).toFixed(2)} MB · Destino: ${selectedPartition}`
                  : 'boot.img, init_boot.img, recovery.img, super.img'}
              </p>
            </div>
          </div>
          <span className={`px-2 py-1 rounded border text-[10px] font-semibold shrink-0 ${dark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-300'}`}>
            Examinar
          </span>
        </label>

        {/* Botón de ejecución Fastboot Flash */}
        <button
          type="button"
          disabled={!flashFile || flashState !== 'fastboot' || flashing}
          onClick={onExecuteFlash}
          className={`w-full py-2 px-3 rounded border text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 ${
            dark
              ? 'bg-zinc-100 text-zinc-950 border-zinc-100 hover:bg-white'
              : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
          }`}
        >
          {flashing ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
          <span>{flashing ? flashProgress : `Flashear en "${selectedPartition}"`}</span>
        </button>
      </div>

      {/* Columna 2: ADB Sideload (.zip) + Referencia Rápida */}
      <div className={`rounded-lg border p-3.5 flex flex-col justify-between gap-3 ${cardCls}`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download size={14} className={dark ? 'text-zinc-300' : 'text-slate-700'} />
              <h3 className="text-xs font-bold uppercase tracking-wider">ADB Sideload (.zip)</h3>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
              Recovery / OTA
            </span>
          </div>

          <p className={`text-xs ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>
            Instala paquetes OTA o Custom ROMs firmadas cuando el dispositivo está en modo Recovery → ADB Sideload.
          </p>

          <label className={`border border-dashed rounded-md p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
            dark ? 'border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
          }`}>
            <input
              type="file"
              accept=".zip"
              className="hidden"
              disabled={flashing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onExecuteSideload(f);
                e.target.value = '';
              }}
            />
            <div className="flex items-center gap-2.5 min-w-0">
              <Download size={16} className="shrink-0 opacity-70" />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">Enviar paquete .ZIP por ADB Sideload</p>
                <p className={`text-[10px] font-mono ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  lineageos.zip, ota-update.zip, magisk.zip
                </p>
              </div>
            </div>
            <span className={`px-2 py-1 rounded border text-[10px] font-semibold shrink-0 ${dark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-slate-300'}`}>
              Cargar ZIP
            </span>
          </label>
        </div>

        {/* Flujo técnico verificado */}
        <div className={`rounded border p-2.5 text-[11px] space-y-1 ${dark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
          <p className="font-bold uppercase text-[10px] tracking-wider">Protocolo de Flasheo Seguro:</p>
          <p>1. En Android activo, pulsa <strong>Verificar OEM</strong> y luego <strong>Ir a Fastboot</strong>.</p>
          <p>2. En Fastboot, pulsa <strong>Detectar estado</strong> para confirmar <code>unlocked: yes</code>.</p>
          <p>3. Elige la partición exacta (ej. <code>boot</code> o <code>init_boot</code>), carga el <code>.img</code> y flashea.</p>
        </div>
      </div>
    </div>
  );
};
