// ============================================================================
// ARCHIVO: useProjectionDrop.ts
// QUÉ HACE: Gestiona el arrastre y soltado (Drag & Drop) de archivos `.apk` o
//           documentos sobre el visor para instalar o transferir vía ADB.
// CÓMO FUNCIONA: Envía FormData a `/api/install-apk` o `/api/upload-file` y
//           limpia automáticamente el temporizador del toast al desmontar.
// POR QUÉ: Aislar I/O de archivos y evitar fugas de memoria por timers (SRP).
// ============================================================================
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface DropStatus {
  status: 'uploading' | 'success' | 'error';
  message: string;
}

export function useProjectionDrop(serial: string) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropStatus, setDropStatus] = useState<DropStatus | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpia cualquier toast pendiente si el componente se desmonta
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!serial || e.dataTransfer.files.length === 0) return;

    const file = e.dataTransfer.files[0];
    const isApk = file.name.toLowerCase().endsWith('.apk');
    setDropStatus({
      status: 'uploading',
      message: isApk ? `Instalando ${file.name}...` : `Transfiriendo ${file.name}...`,
    });

    const fd = new FormData();
    fd.append('file', file);
    fd.append('serial', serial);

    try {
      const res = await fetch(isApk ? '/api/install-apk' : '/api/upload-file', { method: 'POST', body: fd });
      const data = await res.json();
      setDropStatus(
        data.success
          ? { status: 'success', message: data.message || (isApk ? 'APK instalada' : 'Archivo enviado a /sdcard/Download/') }
          : { status: 'error', message: data.error || 'Error en la transferencia' },
      );
    } catch (err: unknown) {
      setDropStatus({ status: 'error', message: err instanceof Error ? err.message : 'Error de red' });
    }

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setDropStatus(null), 4000);
  }, [serial]);

  return { isDragOver, dropStatus, handleDragOver, handleDragLeave, handleDrop };
}
