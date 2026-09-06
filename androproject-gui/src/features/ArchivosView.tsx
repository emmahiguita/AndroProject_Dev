'use client';

import { Copy, FolderOpen } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

import { DeviceInfo } from './types';

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

  const cleanupProgress = (fileName: string) => {
    const next = { ...useAppStore.getState().uploadProgress };
    delete next[fileName];
    setUploadProgress(next);
  };

  return (
    <ViewShell navId="archivos">
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-2.5">
        <Card padding="sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center text-brand-light"><FolderOpen size={14} /></div>
            <div>
              <h2 className="text-xs font-bold">Transferir archivos</h2>
              <p className="text-[10px] text-text-secondary">Copia archivos a la carpeta Descargas del dispositivo.</p>
            </div>
          </div>
        </Card>

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
                  addLog(`Transfiriendo ${file.name}...`);
                  // Use getState() to avoid stale-closure bugs in async callbacks
                  setUploadProgress({ ...useAppStore.getState().uploadProgress, [file.name]: 0 });

                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('dest', '/sdcard/Download');
                  if (activeSerial) formData.append('serial', activeSerial);

                  await new Promise<void>((resolve) => {
                    const xhr = new XMLHttpRequest();
                    xhr.timeout = 120000; // 2 min timeout
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
                        addLog(data.success ? data.message : `Error: ${data.error}`);
                      } catch {
                        addLog(`Error de red al procesar respuesta de ${file.name}`);
                      }
                      cleanupProgress(file.name);
                      resolve();
                    };
                    xhr.onerror = () => {
                      addLog(`Error de red al subir ${file.name}`);
                      cleanupProgress(file.name);
                      resolve();
                    };
                    xhr.ontimeout = xhr.onerror;
                    xhr.onabort = () => {
                      addLog(`Transferencia cancelada: ${file.name}`);
                      cleanupProgress(file.name);
                      resolve();
                    };
                    xhr.send(formData);
                  });
                }
                e.target.value = '';
              }}
            />

            <div className="relative w-full flex flex-col items-center justify-center min-h-[120px]">
              {Object.keys(uploadProgress).length > 0 ? (
                <div className="w-full flex flex-col items-center z-20">
                  <div className="relative w-10 h-10 mb-3">
                    <div className={`relative w-full h-full rounded-full bg-brand/10 flex items-center justify-center text-brand-light border border-brand/30`}>
                      <Copy size={18} className="animate-pulse" />
                    </div>
                  </div>
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
                    o haz clic para seleccionar · <span className="font-mono text-brand-light">/sdcard/Download</span>
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