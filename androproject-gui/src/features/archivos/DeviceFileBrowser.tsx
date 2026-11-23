// ============================================================================
// ARCHIVO: DeviceFileBrowser.tsx
// QUÉ HACE: Explora, descarga y elimina archivos Android mediante ADB.
// CÓMO FUNCIONA: Consulta carpetas y envía operaciones con el serial seleccionado.
// POR QUÉ: Completar la lógica faltante Android → PC en `ArchivosView` (< 200L).
// ============================================================================
'use client';
import { apiUrl } from '@/lib/api-url';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Folder, FileText, Download, Trash2, RefreshCw, ArrowUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface RemoteEntry {
  name: string;
  isDir: boolean;
  size: number;
}

interface DeviceFileBrowserProps {
  dark: boolean;
  serial?: string | null;
  currentPath: string;
  onPathChange: (p: string) => void;
  onStatus: (text: string, ok: boolean) => void;
  refreshSignal: number;
}

export const DeviceFileBrowser: React.FC<DeviceFileBrowserProps> = ({
  dark, serial, currentPath, onPathChange, onStatus, refreshSignal,
}) => {
  const [entries, setEntries] = useState<RemoteEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const requestRef = useRef(0);
  const currentRef = useRef({ serial, currentPath });
  currentRef.current = { serial, currentPath };

  const loadDir = useCallback(async () => {
    const request = ++requestRef.current;
    if (!serial || serial.startsWith('apple-') || serial.startsWith('airplay-')) {
      setEntries([]);
      setLoading(false);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const q = new URLSearchParams({ path: currentPath, serial });
      const r = await fetch(apiUrl(`/api/upload-file?${q.toString()}`), { cache: 'no-store' });
      const d = await r.json();
      // Descarta respuestas tardías si se cambió de carpeta o dispositivo.
      if (request !== requestRef.current) return;
      if (d.success) setEntries(d.entries || []);
      else { const error = d.error || 'No se pudo leer la carpeta del dispositivo.'; setEntries([]); setLoadError(error); onStatus(error, false); }
    } catch {
      if (request !== requestRef.current) return;
      setEntries([]);
      setLoadError('Error consultando archivos del dispositivo.');
      onStatus('Error consultando archivos del dispositivo.', false);
    } finally { if (request === requestRef.current) setLoading(false); }
  }, [serial, currentPath, onStatus]);

  useEffect(() => { loadDir(); return () => { requestRef.current++; }; }, [loadDir, refreshSignal]);

  // El borrado requiere confirmación; la descarga informa la ruta real en el PC.
  const runFileOperation = async (action: 'download' | 'delete', name: string) => {
    if (!serial || operation || (action === 'delete' && !confirm(`¿Eliminar "${name}" del teléfono?`))) return;
    setOperation(name);
    try {
      const response = await fetch(apiUrl(`/api/device-file/${action}`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, path: `${currentPath}/${name}` }),
      });
      const data = await response.json();
      onStatus(`${serial}: ${data.success ? data.message : (data.error || 'No se pudo completar la operación.')}`, Boolean(data.success));
      if (data.success && action === 'delete' && currentRef.current.serial === serial && currentRef.current.currentPath === currentPath) await loadDir();
    } catch { onStatus('Error de comunicación durante la operación de archivo.', false); }
    finally { setOperation(null); }
  };

  const handleGoUp = () => {
    if (currentPath === '/sdcard') return;
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/sdcard';
    onPathChange(parent.startsWith('/sdcard') ? parent : '/sdcard');
  };

  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';
  const formatSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(0)} KB` : `${b} B`);

  return (
    <Card padding="sm" className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-bold">Explorador del Dispositivo (Android → PC)</h3>
          <p className={`text-[11px] font-mono truncate ${mutedCls}`}>{currentPath}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" icon={<ArrowUp size={12} />} onClick={handleGoUp} disabled={currentPath === '/sdcard' || loading}>Subir</Button>
          <Button size="sm" variant="secondary" icon={<RefreshCw size={12} className={loading ? 'animate-spin' : ''} />} onClick={loadDir} disabled={!serial || loading}>Actualizar</Button>
        </div>
      </div>

      <div className={`rounded-lg border max-h-64 overflow-y-auto custom-scrollbar divide-y ${dark ? 'border-zinc-800 divide-zinc-800/70' : 'border-slate-200 divide-slate-200'}`}>
        {!serial ? (
          <p className={`text-xs text-center py-6 ${mutedCls}`}>Conecta un dispositivo Android para explorar su almacenamiento.</p>
        ) : loading ? (
          <p className={`text-xs text-center py-6 ${mutedCls}`}>Leyendo {currentPath}...</p>
        ) : loadError ? (
          <p role="alert" className={`text-xs text-center py-6 ${mutedCls}`}>{loadError}</p>
        ) : entries.length === 0 ? (
          <p className={`text-xs text-center py-6 ${mutedCls}`}>Carpeta vacía.</p>
        ) : entries.map((item) => (
          <div key={item.name} className={`flex items-center justify-between gap-2 px-3 py-2 text-xs ${dark ? 'hover:bg-zinc-900/70' : 'hover:bg-slate-50'}`}>
            <button
              type="button"
              onClick={() => item.isDir && onPathChange(`${currentPath}/${item.name}`)}
              className={`flex items-center gap-2 min-w-0 flex-1 text-left ${item.isDir ? 'cursor-pointer font-semibold' : 'cursor-default'}`}
            >
              {item.isDir ? <Folder size={14} className="shrink-0" /> : <FileText size={14} className={`shrink-0 ${mutedCls}`} />}
              <span className="truncate font-mono">{item.name}</span>
            </button>
            {!item.isDir && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-[10px] font-mono ${mutedCls}`}>{formatSize(item.size)}</span>
                <button type="button" disabled={operation !== null} onClick={() => runFileOperation('download', item.name)} aria-label={`Descargar ${item.name}`} title="Descargar a Capturas/Descargas" className="p-1 rounded border border-border disabled:opacity-50"><Download size={12} /></button>
                <button type="button" disabled={operation !== null} onClick={() => runFileOperation('delete', item.name)} aria-label={`Eliminar ${item.name}`} title="Eliminar del teléfono" className="p-1 rounded border border-border disabled:opacity-50"><Trash2 size={12} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};
