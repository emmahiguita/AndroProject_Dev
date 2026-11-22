// ============================================================================
// ARCHIVO: AppInstallerPanel.tsx
// QUÉ HACE: Subpanel de instalación de paquetes APK/XAPK/APKM por arrastrar o
//           seleccionar archivos hacia el dispositivo Android conectado.
// CÓMO FUNCIONA: Envía cada archivo vía FormData a `POST /api/install-apk`
//           adjuntando el serial activo y registra el resultado en el log.
// POR QUÉ: Aislar la instalación del listado bajo SRP, con estética monocroma
//           legible tanto en modo claro como oscuro (sin bordes neón).
// ============================================================================

'use client';

import React, { useState } from 'react';
import { Smartphone, Download, Loader2 } from 'lucide-react';

interface AppInstallerPanelProps {
  dark: boolean;
  addLog: (msg: string) => void;
  activeSerial: string | null;
  connected: boolean;
}

export function AppInstallerPanel({
  dark,
  addLog,
  activeSerial,
  connected,
}: AppInstallerPanelProps) {
  const [installing, setInstalling] = useState(false);

  /** Procesa secuencialmente los archivos seleccionados contra `/api/install-apk`. */
  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setInstalling(true);
    try {
      for (const file of files) {
        addLog(`Instalando ${file.name}...`);
        const formData = new FormData();
        formData.append('file', file);
        if (activeSerial) formData.append('serial', activeSerial);
        try {
          const res = await fetch('/api/install-apk', { method: 'POST', body: formData });
          const data = await res.json();
          addLog(data.success ? data.message : `Error: ${data.error}`);
        } catch {
          addLog(`Error de red al instalar ${file.name}`);
        }
      }
    } finally {
      setInstalling(false);
      e.target.value = '';
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl mt-5">
      <div
        className={`rounded-xl border p-6 ${
          dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-3 mb-5">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
              dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <Smartphone size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Instalar APK en el dispositivo</h2>
            <p className={`text-xs mt-0.5 ${dark ? 'text-zinc-400' : 'text-slate-600'}`}>
              Selecciona archivos .apk (Android) o .ipa (iOS) desde tu PC para instalarlos.
            </p>
          </div>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center relative transition-colors ${
            dark
              ? 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/40'
              : 'border-slate-300 hover:border-slate-500 bg-slate-50'
          }`}
        >
          <input
            type="file"
            accept=".apk,.ipa"
            multiple
            disabled={!connected || installing}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            onChange={handleFiles}
          />
          <div
            className={`w-14 h-14 rounded-xl border flex items-center justify-center mb-3 ${
              dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            {installing ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} />}
          </div>
          <p className="text-sm font-semibold">
            {installing ? 'Instalando paquete en el dispositivo...' : 'Arrastra archivos APK aquí'}
          </p>
          <p className={`text-xs mt-1 ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
            O haz clic para explorar en tu equipo
          </p>
        </div>

        {!connected && (
          <div
            className={`mt-4 p-3 rounded-lg border text-xs text-center font-medium ${
              dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            Conecta un dispositivo Android para habilitar la instalación de paquetes.
          </div>
        )}
      </div>
    </div>
  );
}
