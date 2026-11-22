// ============================================================================
// ARCHIVO: ArchivosView.tsx
// QUÉ HACE: Vista de transferencia de archivos PC -> Android con selector de
//           carpeta destino (`/sdcard/Download`, `DCIM`, `Pictures`, `Documents`,
//           `Music`), progreso XHR en tiempo real y acceso a Capturas locales.
// CÓMO FUNCIONA: Sube cada archivo vía `XMLHttpRequest` a `POST /api/upload-file`
//           con `dest` dinámico, muestra confirmación visual en pantalla y
//           permite abrir `C:\AndroProject\Capturas` con un clic.
// POR QUÉ: Inyectar lógica real de selección de destino y feedback visible (< 200L).
// ============================================================================
'use client';

import React, { useState } from 'react';
import { Copy, FolderOpen, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { DeviceInfo } from './types';

const DEST_FOLDERS = [
  { label: 'Descargas', path: '/sdcard/Download' },
  { label: 'Cámara (DCIM)', path: '/sdcard/DCIM' },
  { label: 'Imágenes', path: '/sdcard/Pictures' },
  { label: 'Documentos', path: '/sdcard/Documents' },
  { label: 'Música', path: '/sdcard/Music' },
];

interface ArchivosViewProps {
  device?: DeviceInfo | null;
  addLog?: (msg: string) => void;
}

export function ArchivosView({ addLog: propAddLog }: ArchivosViewProps = {}) {
  const { t, dark } = useTheme();
  const storeAddLog = useAppStore((s) => s.addLog);
  const addLog = propAddLog || storeAddLog;
  const uploadProgress = useAppStore((s) => s.uploadProgress);
  const setUploadProgress = useAppStore((s) => s.setUploadProgress);
  const activeSerial = useAppStore((s) => s.activeSerial);
  const [destFolder, setDestFolder] = useState('/sdcard/Download');
  const [statusBanner, setStatusBanner] = useState<{ text: string; ok: boolean } | null>(null);

  const cleanupProgress = (fileName: string) => {
    const next = { ...useAppStore.getState().uploadProgress };
    delete next[fileName];
    setUploadProgress(next);
  };

  const handleOpenLocalCaptures = async () => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open_captures', serial: activeSerial }),
      });
      const d = await res.json();
      setStatusBanner({ text: d.message || 'Carpeta de Capturas abierta en el PC.', ok: Boolean(d.success) });
    } catch { setStatusBanner({ text: 'No se pudo abrir la carpeta local de Capturas.', ok: false }); }
  };

  return (
    <ViewShell navId="archivos">
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-2.5">
        <Card padding="sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center text-brand-light"><FolderOpen size={14} /></div>
              <div>
                <h2 className="text-xs font-bold">Transferir archivos al dispositivo</h2>
                <p className="text-[10px] text-text-secondary">Selecciona la carpeta destino en Android y arrastra tus archivos.</p>
              </div>
            </div>
            <Button size="sm" variant="secondary" icon={<FolderOpen size={12} />} onClick={handleOpenLocalCaptures}>Abrir Capturas PC</Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-border">
            <span className="text-[10px] font-semibold text-text-secondary mr-1">Destino:</span>
            {DEST_FOLDERS.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => setDestFolder(f.path)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                  destFolder === f.path
                    ? dark ? 'bg-zinc-100 text-zinc-950 border-zinc-100' : 'bg-slate-900 text-white border-slate-900'
                    : dark ? 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                {f.label} ({f.path.replace('/sdcard', '')})
              </button>
            ))}
          </div>
        </Card>

        {statusBanner && (
          <div className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-center gap-2 ${
            dark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
          } ${statusBanner.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {statusBanner.ok ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
            <span className="font-mono break-all">{statusBanner.text}</span>
          </div>
        )}

        <Card padding="none">
          <div className={`border-2 border-dashed ${t.dashedBorder} hover:border-brand/50 transition-all rounded-lg p-8 flex flex-col items-center justify-center ${t.bg} relative group hover:bg-brand/5`}>
            <input
              type="file"
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;

                for (const file of files) {
                  addLog(`Transfiriendo ${file.name} -> ${destFolder}...`);
                  setUploadProgress({ ...useAppStore.getState().uploadProgress, [file.name]: 0 });

                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('dest', destFolder);
                  if (activeSerial) formData.append('serial', activeSerial);

                  await new Promise<void>((resolve) => {
                    const xhr = new XMLHttpRequest();
                    xhr.timeout = 120000;
                    xhr.open('POST', '/api/upload-file');
                    xhr.upload.onprogress = (event) => {
                      if (event.lengthComputable) {
                        const current = useAppStore.getState().uploadProgress;
                        setUploadProgress({ ...current, [file.name]: Math.round((event.loaded / event.total) * 100) });
                      }
                    };
                    xhr.onload = () => {
                      try {
                        const data = JSON.parse(xhr.responseText);
                        const msg = data.success ? (data.message || `${file.name} copiado a ${destFolder}`) : `Error: ${data.error}`;
                        addLog(msg); setStatusBanner({ text: msg, ok: Boolean(data.success) });
                      } catch {
                        const err = `Error al procesar respuesta de ${file.name}`;
                        addLog(err); setStatusBanner({ text: err, ok: false });
                      }
                      cleanupProgress(file.name); resolve();
                    };
                    xhr.onerror = () => {
                      const err = `Error de red al subir ${file.name}`;
                      addLog(err); setStatusBanner({ text: err, ok: false });
                      cleanupProgress(file.name); resolve();
                    };
                    xhr.ontimeout = xhr.onerror;
                    xhr.onabort = () => { cleanupProgress(file.name); resolve(); };
                    xhr.send(formData);
                  });
                }
                e.target.value = '';
              }}
            />

            <div className="relative w-full flex flex-col items-center justify-center min-h-[120px]">
              {Object.keys(uploadProgress).length > 0 ? (
                <div className="w-full flex flex-col items-center z-20">
                  <div className="w-full max-w-md space-y-2">
                    {Object.entries(uploadProgress).map(([fileName, progress]) => (
                      <Card key={fileName} padding="sm" className="w-full backdrop-blur-sm transition-all">
                        <div className="flex justify-between text-[10px] mb-1.5 items-center">
                          <span className={`truncate max-w-[80%] font-medium ${t.text}`}>{fileName}</span>
                          <Badge tone="brand" className="font-bold text-[10px]">{progress}%</Badge>
                        </div>
                        <div className="w-full h-1.5 bg-black/10 dark:bg-black/40 rounded-full overflow-hidden relative">
                          <div className="absolute top-0 left-0 h-full bg-brand transition-all duration-[400ms] ease-out" style={{ width: `${progress}%` }} />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center transition-all">
                  <div className={`w-12 h-12 rounded-xl ${t.cardInner} group-hover:bg-brand/10 flex items-center justify-center ${t.textSub} group-hover:text-brand-light transition-all mb-3`}>
                    <Copy size={20} />
                  </div>
                  <p className="text-xs font-bold group-hover:text-brand-light transition-colors">Arrastra archivos aquí</p>
                  <p className={`text-[10px] ${t.textSub} mt-1`}>
                    o haz clic para seleccionar · Destino: <span className="font-mono text-brand-light">{destFolder}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </ViewShell>
  );
}
