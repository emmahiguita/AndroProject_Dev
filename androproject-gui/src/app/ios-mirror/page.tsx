// Estado del receptor y detección USB mediante Windows Plug and Play.
'use client';
import { apiUrl } from '@/lib/api-url';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAirPlayServer } from '@/hooks/useAirPlayServer';
import './ios-mirror.css';

export default function IOSMirrorPage() {
  const { status, loading, error, toggleServer, refresh } = useAirPlayServer();
  const [usbMessage, setUsbMessage] = useState('');
  const [checkingUsb, setCheckingUsb] = useState(false);

  // El inventario USB es independiente de la conexión de vídeo por AirPlay.
  async function checkUsb() {
    setCheckingUsb(true);
    try {
      const response = await fetch(apiUrl('/api/ios'), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Falló la consulta USB');
      setUsbMessage(data.usbDevices.length
        ? data.usbDevices.map((d: { FriendlyName: string; Status: string }) => `${d.FriendlyName} (${d.Status})`).join(' · ')
        : 'Windows no detectó un iPhone o iPad por USB.');
    } catch (error) {
      setUsbMessage(error instanceof Error ? error.message : 'Error consultando Windows');
    } finally { setCheckingUsb(false); }
  }

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
        <Button size="sm" variant="secondary" onClick={checkUsb} loading={checkingUsb}>Detectar por USB</Button>
        <Button size="sm" variant="secondary" onClick={refresh} aria-label="Actualizar estado de AirPlay" title="Actualizar estado de AirPlay" className="px-2">
          <RefreshCw size={16} />
        </Button>
      </header>

      {(usbMessage || error) && (
        <div role={error ? 'alert' : 'status'} className={`max-w-4xl rounded-md border border-border bg-surface-card px-3 py-2 text-sm ${error ? 'text-semantic-danger' : 'text-text-secondary'}`}>
          {error || usbMessage}
        </div>
      )}

      <section className="iphone">
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
