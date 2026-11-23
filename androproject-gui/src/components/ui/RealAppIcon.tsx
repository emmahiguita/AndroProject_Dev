// ============================================================================
// ARCHIVO: RealAppIcon.tsx
// QUÉ HACE: Renderiza el icono real extraído del APK Android con carga diferida
//           (`loading="lazy"`) y fallback limpio a inicial si el paquete no
//           expone recurso rasterizado.
// CÓMO FUNCIONA: Solicita `/api/apps/icon?package=...&serial=...` y conmuta a
//           un distintivo sobrio únicamente si `onError` se dispara.
// POR QUÉ: Reemplazar círculos de iniciales genéricos por iconos reales del
//           teléfono manteniendo la UI rápida y ligera (< 55 líneas).
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api-url';

interface RealAppIconProps {
  packageName: string;
  appName: string;
  serial?: string;
  fallbackColor: string;
  sizeClass?: string;
}

export function RealAppIcon({
  packageName,
  appName,
  serial,
  fallbackColor,
  sizeClass = 'w-7 h-7',
}: RealAppIconProps) {
  const [failed, setFailed] = useState(false);
  const [source, setSource] = useState<string | null>(null);

  // La URL se decide en el cliente para evitar diferencias con el render estático.
  useEffect(() => {
    const query = new URLSearchParams({ package: packageName });
    if (serial && serial !== 'Hardware Level') query.set('serial', serial);
    setFailed(false);
    setSource(apiUrl(`/api/apps/icon?${query.toString()}`));
  }, [packageName, serial]);

  if (failed || !packageName || !source) {
    return (
      <div
        className={`${sizeClass} rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0`}
        style={{ backgroundColor: fallbackColor }}
      >
        {(appName || packageName).charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={source}
      alt={appName}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-lg object-cover shrink-0 bg-zinc-900/40`}
    />
  );
}
