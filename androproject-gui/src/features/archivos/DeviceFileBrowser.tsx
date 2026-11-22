// ============================================================================
// ARCHIVO: DeviceFileBrowser.tsx
// QUÉ HACE: Explorador bidireccional de archivos Android (`/sdcard/...`) que
//           permite navegar carpetas, descargar archivos al PC (`adb pull`)
//           y eliminar archivos del dispositivo (`rm -f`).
// CÓMO FUNCIONA: Consulta `GET /api/upload-file?path=...&serial=...` y
//           despacha descargas o borrados con confirmación explícita.
// POR QUÉ: Completar la lógica faltante Android → PC en `ArchivosView` (< 200L).
// ============================================================================
'use client';

import React, { useState, useEffect, useCallback } from 'react';
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

  const loadDir = useCallback(async () => {
    if (!serial || serial.startsWith('apple-') || serial.startsWith('airplay-')) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ path: currentPath, serial });
      const r = await fetch(`/api/upload-file?${q.toString()}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.success) setEntries(d.entries || []);
      else onStatus(d.error || 'No se pudo leer la carpeta del dispositivo.', false);
    } catch {
      onStatus('Error consultando archivos del dispositivo.', false);
    } finally { setLoading(false); }
  }, [serial, currentPath, onStatus]);

  useEffect(() => { loadDir(); }, [loadDir, refreshSignal]);

  const handleGoUp = () => {
    if (currentPath === '/sdcard') return;
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/sdcard';
    onPathChange(parent.startsWith('/sdcard') ? parent : '/sdcard');
  };

  const handleDownload = (name: string) => {
    if (!serial) return;
    const full = `${currentPath}/${name}`;
    const q = new URLSearchParams({ path: full, serial, download: '1' });
    window.open(`/api/upload-file?${q.toString()}`, '_blank', 'noopener,noreferrer');
    onStatus(`Descargando ${name} desde el dispositivo...`, true);
  };

  const handleDelete = async (name: string) => {
    if (!serial || !confirm(`¿Eliminar "${name}" de ${currentPath} en el teléfono?`)) return;
    try {
      const r = await fetch('/api/upload-file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, path: `${currentPath}/${name}` }),
      });
      const d = await r.json();
      onStatus(d.message || d.error || 'Operación completada', Boolean(d.success));
      if (d.success) loadDir();
    } catch { onStatus('Error de red al eliminar archivo.', false); }
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
                <button type="button" onClick={() => handleDownload(item.name)} title="Descargar al PC" className={`p-1 rounded border cursor-pointer ${dark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-slate-200 hover:bg-slate-200'}`}><Download size={12} /></button>
                <button type="button" onClick={() => handleDelete(item.name)} title="Eliminar del teléfono" className={`p-1 rounded border cursor-pointer ${dark ? 'border-zinc-800 hover:bg-zinc-800' : 'border-slate-200 hover:bg-slate-200'}`}><Trash2 size={12} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};
