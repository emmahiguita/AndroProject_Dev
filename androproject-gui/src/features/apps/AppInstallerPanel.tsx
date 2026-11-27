// ============================================================================
// ARCHIVO: AppInstallerPanel.tsx
// QUÉ HACE: Subpanel de instalación de paquetes APK por arrastrar o
//           seleccionar archivos hacia el dispositivo conectado.
// CÓMO FUNCIONA: Envía cada archivo vía FormData a `POST /api/install-apk`,
//           muestra el estado de instalación en vivo y refresca el catálogo.
// POR QUÉ: Aislar la instalación del listado bajo SRP (< 150 líneas) con
//          feedback visual inmediato y diseño neutro de estudio.
// ============================================================================

'use client';
import { apiUrl } from '@/lib/api-url';

import React, { useState } from 'react';
import { Smartphone, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface AppInstallerPanelProps {
  dark: boolean;
  addLog: (msg: string) => void;
  activeSerial: string | null;
  connected: boolean;
  onInstalled?: () => void;
}

export function AppInstallerPanel({
  dark,
  addLog,
  activeSerial,
  connected,
  onInstalled,
}: AppInstallerPanelProps) {
  const [installing, setInstalling] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);

  /** Procesa secuencialmente los archivos APK contra `/api/install-apk`. */
  const installApkFiles = async (rawFiles: File[]) => {
    const files = rawFiles.filter((f) => f.name.toLowerCase().endsWith('.apk'));
    if (files.length === 0) {
      setStatusMsg({ text: 'Solo se admiten archivos con extensión .apk.', ok: false });
      return;
    }
    setInstalling(true);
    setStatusMsg(null);
    let anyInstalled = false;
    try {
      for (const file of files) {
        addLog(`Instalando ${file.name}...`);
        setStatusMsg({ text: `Instalando ${file.name} en ${activeSerial || 'dispositivo'}...`, ok: true });
        const formData = new FormData();
        formData.append('file', file);
        if (activeSerial) formData.append('serial', activeSerial);
        try {
          const res = await fetch(apiUrl('/api/install-apk'), { method: 'POST', body: formData });
          const data = await res.json();
          if (data.success) {
            anyInstalled = true;
            const msg = data.message || `${file.name} instalado correctamente.`;
            addLog(msg);
            setStatusMsg({ text: msg, ok: true });
          } else {
            const err = `Error instalando ${file.name}: ${data.error || 'fallo ADB'}`;
            addLog(err);
            setStatusMsg({ text: err, ok: false });
          }
        } catch {
          const err = `Error de red al instalar ${file.name}`;
          addLog(err);
          setStatusMsg({ text: err, ok: false });
        }
      }
      if (anyInstalled && onInstalled) onInstalled();
    } finally {
      setInstalling(false);
    }
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length > 0) await installApkFiles(files);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (!connected || installing) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) await installApkFiles(files);
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl mt-4">
      <div className={`rounded-xl border p-6 ${dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'}`}>
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            <Smartphone size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Instalar APK en Android</h2>
            <p className={`text-xs mt-0.5 ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Selecciona archivos .apk desde tu PC para instalarlos en el Android conectado.
            </p>
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); if (connected && !installing) setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center relative transition-colors ${
            isDragging
              ? (dark ? 'border-emerald-400 bg-emerald-950/30' : 'border-emerald-600 bg-emerald-50')
              : (dark ? 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/40' : 'border-slate-300 hover:border-slate-500 bg-slate-50')
          }`}
        >
          <input
            type="file"
            accept=".apk"
            multiple
            disabled={!connected || installing}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            onChange={handleFiles}
          />
          <div className={`w-14 h-14 rounded-xl border flex items-center justify-center mb-3 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'}`}>
            {installing ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} />}
          </div>
          <p className="text-sm font-semibold">
            {installing ? 'Instalando paquete en el dispositivo...' : 'Selecciona archivos APK'}
          </p>
          <p className={`text-xs mt-1 ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
            O haz clic para explorar en tu equipo
          </p>
        </div>

        {statusMsg && (
          <div className={`mt-4 p-3 rounded-lg border text-xs flex items-center gap-2 ${
            dark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'
          } ${statusMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {statusMsg.ok ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
            <span className="font-mono break-all">{statusMsg.text}</span>
          </div>
        )}

        {!connected && (
          <div className={`mt-4 p-3 rounded-lg border text-xs text-center font-medium ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            Conecta un dispositivo Android para habilitar la instalación de paquetes.
          </div>
        )}
      </div>
    </div>
  );
}
