// ============================================================================
// ARCHIVO: useVisionHealth.ts
// QUÉ HACE: Gestiona la URL del servidor Vision Backend y el polling de salud
//           (`/health`) para detectar si el backend está en línea (CUDA/CPU).
// CÓMO FUNCIONA: Ajusta automáticamente el host si se accede desde LAN y
//           consulta `/health` cada 8 segundos.
// POR QUÉ: Desacoplar el monitoreo de salud del hook WebRTC (< 200L, SRP).
// ============================================================================
'use client';

import { useState, useEffect, useCallback } from 'react';
import { checkVisionBackendHealth, type VisionBackendHealth } from './cameraTypes';

const DEFAULT_SERVER_URL = 'http://127.0.0.1:8000/vision/offer';

export function useVisionHealth() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [backendHealth, setBackendHealth] = useState<VisionBackendHealth>({
    online: false,
    backend: 'offline',
    activeConnections: 0,
  });

  useEffect(() => {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return;
    const t = setTimeout(() => setServerUrl(`http://${h}:8000/vision/offer`), 0);
    return () => clearTimeout(t);
  }, []);

  const refreshHealth = useCallback(async () => {
    const h = await checkVisionBackendHealth(serverUrl);
    setBackendHealth(h);
    return h;
  }, [serverUrl]);

  useEffect(() => {
    const t = setTimeout(() => { void refreshHealth(); }, 0);
    const id = setInterval(() => { void refreshHealth(); }, 8000);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [refreshHealth]);

  return { serverUrl, setServerUrl, backendHealth, refreshHealth };
}
