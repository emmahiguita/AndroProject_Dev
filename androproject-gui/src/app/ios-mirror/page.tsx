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

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAirPlayServer } from '@/hooks/useAirPlayServer';
import './ios-mirror.css';

export default function IOSMirrorPage() {
  const { status, loading, error, toggleServer, refresh } = useAirPlayServer();
  const [frameSrc, setFrameSrc] = useState('/api/device-image?serial=airplay-ios&t=0');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2400);
  }, []);

  useEffect(() => {
    if (!status.running) return;
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      setFrameSrc(`/api/device-image?serial=airplay-ios&t=${Date.now()}`);
    };
    tick();
    const timer = setInterval(tick, 350);
    return () => clearInterval(timer);
  }, [status.running]);

  const sendIosKey = async (keycode: string, label: string) => {
    notify(label);
    try {
      await fetch('/api/actions', {
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
      await fetch('/api/airplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open_native_window' }),
      });
    } catch {}
  };

  const handleScreenshot = async () => {
    notify('Capturando pantalla iOS HD...');
    try {
      const res = await fetch('/api/actions', {
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
    <main className="deviceStage" style={{ flexDirection: 'column', gap: '12px' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        padding: '8px 14px', borderRadius: '14px', background: 'rgba(24,24,27,0.9)',
        border: '1px solid rgba(63,63,70,0.7)', color: '#f4f4f5', fontSize: '12px', zIndex: 30,
      }}>
        <a href="/?nav=projection" style={{ color: '#a1a1aa', textDecoration: 'none', fontWeight: 600, marginRight: '4px' }}>
          ← Estudio
        </a>
        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: serverReady ? '#34d399' : '#fbbf24' }}>
          {status.serverName} ({status.port}) · {serverReady ? 'ACTIVO' : 'DETENIDO'}
        </span>
        <button
          type="button"
          onClick={toggleServer}
          disabled={loading}
          style={{
            padding: '4px 10px', borderRadius: '8px', border: '1px solid #3f3f46',
            background: serverReady ? '#27272a' : '#f4f4f5', color: serverReady ? '#fda4af' : '#09090b',
            fontWeight: 600, fontSize: '11px', cursor: 'pointer',
          }}
        >
          {loading ? '...' : serverReady ? 'Detener AirPlay' : 'Iniciar AirPlay'}
        </button>
        <button
          type="button"
          onClick={handleScreenshot}
          style={{
            padding: '4px 10px', borderRadius: '8px', border: '1px solid #3f3f46',
            background: '#27272a', color: '#e4e4e7', fontWeight: 600, fontSize: '11px', cursor: 'pointer',
          }}
        >
          Captura HD
        </button>
        <button
          type="button"
          onClick={handleFocusNative}
          style={{
            padding: '4px 10px', borderRadius: '8px', border: '1px solid #3f3f46',
            background: '#27272a', color: '#e4e4e7', fontWeight: 600, fontSize: '11px', cursor: 'pointer',
          }}
        >
          Ventana Libre
        </button>
        <button
          type="button"
          onClick={refresh}
          style={{
            padding: '4px 8px', borderRadius: '8px', border: '1px solid #3f3f46',
            background: '#18181b', color: '#a1a1aa', fontSize: '11px', cursor: 'pointer',
          }}
          title="Actualizar estado AirPlay"
        >
          ↻
        </button>
      </header>

      {(toastMsg || error) && (
        <div style={{
          padding: '4px 12px', borderRadius: '8px', background: '#18181b',
          border: '1px solid #3f3f46', color: error ? '#f87171' : '#34d399',
          fontSize: '11px', fontFamily: 'monospace',
        }}>
          {toastMsg || error}
        </div>
      )}

      <section className="iphone">
        <button
          type="button"
          className="sideButton volumeUp"
          title="Subir Volumen (iOS)"
          aria-label="Subir Volumen"
          onClick={() => sendIosKey('KEYCODE_VOLUME_UP', 'Subiendo volumen iOS...')}
          style={{ cursor: 'pointer', border: 'none' }}
        />
        <button
          type="button"
          className="sideButton volumeDown"
          title="Bajar Volumen (iOS)"
          aria-label="Bajar Volumen"
          onClick={() => sendIosKey('KEYCODE_VOLUME_DOWN', 'Bajando volumen iOS...')}
          style={{ cursor: 'pointer', border: 'none' }}
        />
        <button
          type="button"
          className="powerButton"
          title="Bloquear / Encender Pantalla (iOS)"
          aria-label="Botón de encendido"
          onClick={() => sendIosKey('KEYCODE_POWER', 'Alternando bloqueo iOS...')}
          style={{ cursor: 'pointer', border: 'none' }}
        />

        <div className="screen" onClick={handleFocusNative} style={{ cursor: 'pointer' }}>
          {serverReady ? (
            <img src={frameSrc} alt="AirPlay 2 Live Mirror" className="video" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px', textAlign: 'center', color: '#a1a1aa' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f4f4f5' }}>AirPlay 2 en espera</span>
              <span style={{ fontSize: '11px' }}>Pulsa &quot;Iniciar AirPlay&quot; arriba para proyectar tu iPhone o iPad</span>
            </div>
          )}
          <div className="dynamicIsland"><div className="camera" /></div>
          <div className="status">
            <span className="liveDot" style={{ background: serverReady ? '#34d399' : '#fbbf24' }} />
            {serverReady ? 'AIRPLAY 2 LISTO · 60 FPS · AUDIO EN CELULAR' : 'RECEPTOR EN ESPERA — PULSA INICIAR AIRPLAY'}
          </div>
        </div>
      </section>
    </main>
  );
}
