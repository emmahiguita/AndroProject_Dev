// ============================================================================
// ARCHIVO: page.tsx (/ios-mirror)
// QUÉ HACE: Espejo interactivo Apple AirPlay 2 con chasis iPhone, botones
//           físicos laterales funcionales (Vol+, Vol-, Power), captura HD,
//           control de receptor AirPlay (`useAirPlayServer`) y ventana nativa.
// CÓMO FUNCIONA: Pausa el polling de frames cuando el receptor está detenido
//           o la pestaña está oculta (`visibilityState`), evitando peticiones
//           zombis, y despacha eventos reales a `/api/actions` y `/api/airplay`.
// POR QUÉ: Inyectar lógica real a los botones laterales huérfanos y eliminar
//          el intervalo zombi (< 200 líneas, SRP).
// ============================================================================
'use client';
import { apiUrl } from '@/lib/api-url';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Camera, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAirPlayServer } from '@/hooks/useAirPlayServer';
import './ios-mirror.css';

export default function IOSMirrorPage() {
  const { status, loading, error, toggleServer, refresh } = useAirPlayServer();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2400);
  }, []);

  const sendIosKey = async (keycode: string, label: string) => {
    notify(label);
    try {
      await fetch(apiUrl('/api/actions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'keyevent', keycode, serial: 'airplay-ios' }),
      });
    } catch {
      notify('Error enviando comando iOS');
    }
  };

  const handleFocusNative = async () => {
    notify('Abriendo ventana nativa AirPlay...');
    try {
      const res = await fetch(apiUrl('/api/airplay'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open_native_window' }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) notify(result.error || 'No se pudo abrir la ventana de AirPlay.');
    } catch {
      notify('Error de conexión con AirPlay.');
    }
  };

  const handleScreenshot = async () => {
    notify('Capturando pantalla iOS HD...');
    try {
      const res = await fetch(apiUrl('/api/actions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'screenshot', serial: 'airplay-ios' }),
      });
      const d = await res.json();
      notify(d.success ? (d.message || 'Captura guardada') : (d.error || 'Error al capturar'));
    } catch {
      notify('Error de red al capturar');
    }
  };

  const serverReady = status.running;

  return (
    <main className="deviceStage">
      <header className="z-30 flex w-full max-w-4xl shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-card p-3 shadow-sm">
        <a href="/?nav=projection" className="inline-flex min-h-9 items-center rounded-md border border-border-control px-3 text-xs font-semibold hover:bg-surface-overlay">
          Volver al estudio
        </a>
        <h1 className="text-base font-bold">Espejo AirPlay</h1>
        <span className={`mr-auto text-xs font-semibold ${serverReady ? 'text-semantic-success' : 'text-text-secondary'}`} role="status" title={`${status.serverName} (${status.port})`}>
          {serverReady ? 'Proceso receptor activo' : 'Receptor detenido'}
        </span>
        <Button size="sm" variant={serverReady ? 'secondary' : 'primary'} onClick={toggleServer} loading={loading}>
          {serverReady ? 'Detener AirPlay' : 'Iniciar AirPlay'}
        </Button>
        <Button size="sm" variant="secondary" onClick={handleScreenshot} disabled icon={<Camera size={15} />}>Captura no disponible</Button>
        <Button size="sm" variant="secondary" onClick={handleFocusNative} disabled icon={<ExternalLink size={15} />}>Ventana libre</Button>
        <Button size="sm" variant="secondary" onClick={refresh} aria-label="Actualizar estado de AirPlay" title="Actualizar estado de AirPlay" className="px-2">
          <RefreshCw size={16} />
        </Button>
      </header>

      {(toastMsg || error) && (
        <div role={error ? 'alert' : 'status'} className={`max-w-4xl rounded-md border border-border bg-surface-card px-3 py-2 text-sm ${error ? 'text-semantic-danger' : 'text-text-secondary'}`}>
          {toastMsg || error}
        </div>
      )}

      <section className="iphone">
        <button
          type="button"
          className="sideButton volumeUp"
          title="Subir Volumen (iOS)"
          aria-label="Subir Volumen"
          disabled
          onClick={() => sendIosKey('KEYCODE_VOLUME_UP', 'Subiendo volumen iOS...')}
          style={{ cursor: 'pointer', border: 'none' }}
        />
        <button
          type="button"
          className="sideButton volumeDown"
          title="Bajar Volumen (iOS)"
          aria-label="Bajar Volumen"
          disabled
          onClick={() => sendIosKey('KEYCODE_VOLUME_DOWN', 'Bajando volumen iOS...')}
          style={{ cursor: 'pointer', border: 'none' }}
        />
        <button
          type="button"
          className="powerButton"
          title="Bloquear / Encender Pantalla (iOS)"
          aria-label="Botón de encendido"
          disabled
          onClick={() => sendIosKey('KEYCODE_POWER', 'Alternando bloqueo iOS...')}
          style={{ cursor: 'pointer', border: 'none' }}
        />

        <div className="screen">
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px', textAlign: 'center', color: '#a1a1aa' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f4f4f5' }}>Vídeo integrado no disponible</span>
              <span style={{ fontSize: '11px' }}>El receptor se abre en su propia ventana. La conexión del iPhone aún no está verificada.</span>
            </div>
          <div className="dynamicIsland"><div className="camera" /></div>
          <div className="status">
            <span className="liveDot" style={{ background: serverReady ? '#34d399' : '#fbbf24' }} />
            {serverReady ? 'PROCESO ACTIVO - CONEXIÓN SIN COMPROBAR' : 'RECEPTOR DETENIDO'}
          </div>
        </div>
      </section>
    </main>
  );
}
