// ============================================================================
// ARCHIVO: ArchivosView.tsx
// QUÉ HACE: Envía archivos a Android y explora su almacenamiento compartido.
// CÓMO FUNCIONA: Sube archivos vía `XMLHttpRequest` (`POST /api/upload-file`)
//           con progreso de subida al servidor y `DeviceFileBrowser` para listar.
// POR QUÉ: Separar la transferencia del explorador y facilitar el mantenimiento.
// ============================================================================
'use client';
import { apiUrl } from '@/lib/api-url';

import React, { useState, useCallback } from 'react';
import { Copy, FolderOpen, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DeviceFileBrowser } from './archivos/DeviceFileBrowser';
import type { DeviceInfo } from './types';

const DEST_FOLDERS = [
  { label: 'Descargas', path: '/sdcard/Download' },
  { label: 'Cámara (DCIM)', path: '/sdcard/DCIM' },
  { label: 'Imágenes', path: '/sdcard/Pictures' },
  { label: 'Documentos', path: '/sdcard/Documents' },
  { label: 'Música', path: '/sdcard/Music' },
];

export function ArchivosView({ device, addLog: propAddLog }: { device?: DeviceInfo | null; addLog?: (msg: string) => void } = {}) {
  const { dark } = useTheme();
  const storeAddLog = useAppStore((s) => s.addLog);
  const addLog = propAddLog || storeAddLog;
  const uploadProgress = useAppStore((s) => s.uploadProgress);
  const setUploadProgress = useAppStore((s) => s.setUploadProgress);
  const activeSerial = useAppStore((s) => s.activeSerial);
  const storeDevice = useAppStore((s) => s.device);
  const targetSerial = activeSerial || device?.serial || storeDevice?.serial || null;

  const [destFolder, setDestFolder] = useState('/sdcard/Download');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [statusBanner, setStatusBanner] = useState<{ text: string; ok: boolean } | null>(null);

  const handleStatus = useCallback((text: string, ok: boolean) => {
    setStatusBanner({ text, ok });
    addLog(text);
  }, [addLog]);

  const cleanupProgress = (fileName: string) => {
    const next = { ...useAppStore.getState().uploadProgress };
    delete next[fileName];
    setUploadProgress(next);
  };

  const handleOpenLocalCaptures = async () => {
    try {
      const res = await fetch(apiUrl('/api/actions'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open_captures', serial: targetSerial }),
      });
      const d = await res.json();
      setStatusBanner({ text: d.success ? (d.message || 'Carpeta de Capturas abierta en el PC.') : (d.error || 'No se pudo abrir la carpeta de Capturas.'), ok: Boolean(d.success) });
    } catch { setStatusBanner({ text: 'No se pudo abrir la carpeta local de Capturas.', ok: false }); }
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (const file of files) {
      addLog(`Transfiriendo ${file.name} -> ${destFolder}...`);
      setUploadProgress({ ...useAppStore.getState().uploadProgress, [file.name]: 0 });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dest', destFolder);
      if (targetSerial) formData.append('serial', targetSerial);

      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.timeout = 120000;
        xhr.open('POST', apiUrl('/api/upload-file'));
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress({ ...useAppStore.getState().uploadProgress, [file.name]: Math.round((ev.loaded / ev.total) * 100) });
        };
        xhr.onload = () => {
          try {
            const d = JSON.parse(xhr.responseText);
            handleStatus(d.success ? (d.message || `${file.name} copiado a ${destFolder}`) : `Error: ${d.error}`, Boolean(d.success));
          } catch { handleStatus(`Error al procesar respuesta de ${file.name}`, false); }
          cleanupProgress(file.name); resolve();
        };
        xhr.onerror = () => { handleStatus(`Error de red al subir ${file.name}`, false); cleanupProgress(file.name); resolve(); };
        xhr.ontimeout = xhr.onerror;
        xhr.onabort = () => { cleanupProgress(file.name); resolve(); };
        xhr.send(formData);
      });
    }
    e.target.value = '';
    setRefreshSignal((n) => n + 1);
  };

  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';

  return (
    <ViewShell navId="archivos">
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-2.5 pb-8">
        <Card padding="sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                <FolderOpen size={14} />
              </div>
              <div>
                <h2 className="text-xs font-bold">Transferencia y Explorador de Archivos (PC ↔ Android)</h2>
                <p className={`text-[11px] ${mutedCls}`}>Sube archivos por ADB y descarga a Capturas/Descargas o elimina archivos confirmados.</p>
              </div>
            </div>
            <Button size="sm" variant="secondary" icon={<FolderOpen size={12} />} onClick={handleOpenLocalCaptures}>Abrir Capturas PC</Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-border">
            <span className={`text-[11px] font-semibold ${mutedCls} mr-1`}>Carpeta activa:</span>
            {DEST_FOLDERS.map((f) => (
              <button
                key={f.path} type="button" onClick={() => setDestFolder(f.path)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border transition-colors cursor-pointer ${
                  destFolder === f.path ? (dark ? 'bg-zinc-100 text-zinc-950 border-zinc-100' : 'bg-slate-900 text-white border-slate-900')
                                        : (dark ? 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200')
                }`}
              >
                {f.label} ({f.path.replace('/sdcard', '')})
              </button>
            ))}
          </div>
        </Card>

        {statusBanner && (
          <div className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-center gap-2 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'}`}>
            {statusBanner.ok ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
            <span className="font-mono break-all">{statusBanner.text}</span>
          </div>
        )}

        <Card padding="none">
          <div className={`border-2 border-dashed transition-all rounded-xl p-6 flex flex-col items-center justify-center relative ${dark ? 'border-zinc-800 hover:border-zinc-600 bg-zinc-950' : 'border-slate-300 hover:border-slate-500 bg-slate-50'}`}>
            <input type="file" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleUploadFiles} />
            <div className="relative w-full flex flex-col items-center justify-center min-h-[100px]">
              {Object.keys(uploadProgress).length > 0 ? (
                <div className="w-full max-w-md space-y-2 z-20">
                  {Object.entries(uploadProgress).map(([fileName, progress]) => (
                    <Card key={fileName} padding="sm" className="w-full">
                      <div className="flex justify-between text-xs mb-1.5 items-center"><span className="truncate max-w-[80%] font-medium">{fileName}</span><Badge tone="neutral">{progress}% al servidor</Badge></div>
                      <div className={`w-full h-1.5 rounded-full overflow-hidden ${dark ? 'bg-zinc-800' : 'bg-slate-200'}`}><div className={`h-full transition-all duration-300 ${dark ? 'bg-zinc-200' : 'bg-slate-800'}`} style={{ width: `${progress}%` }} /></div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-2 ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'}`}><Copy size={18} /></div>
                  <p className="text-xs font-bold">Arrastra archivos aquí (PC → Android)</p>
                  <p className={`text-xs ${mutedCls} mt-0.5`}>o haz clic para seleccionar · Destino: <span className="font-mono font-semibold">{destFolder}</span></p>
                </div>
              )}
            </div>
          </div>
        </Card>

        <DeviceFileBrowser dark={dark} serial={targetSerial} currentPath={destFolder} onPathChange={setDestFolder} onStatus={handleStatus} refreshSignal={refreshSignal} />
      </div>
    </ViewShell>
  );
}
