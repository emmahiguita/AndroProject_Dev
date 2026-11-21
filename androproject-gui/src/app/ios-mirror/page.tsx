'use client';

import { useEffect, useState } from 'react';
import { useAirPlayServer } from '@/hooks/useAirPlayServer';
import './ios-mirror.css';

export default function IOSMirrorPage() {
  const { status } = useAirPlayServer();
  const [frameSrc, setFrameSrc] = useState('/api/device-image?serial=airplay-ios&t=0');

  useEffect(() => {
    // Only poll frame updates if the AirPlay receiver is running
    const timer = setInterval(() => {
      setFrameSrc(`/api/device-image?serial=airplay-ios&t=${Date.now()}`);
    }, 350);

    return () => clearInterval(timer);
  }, []);

  const handleFocusNative = async () => {
    try {
      await fetch('/api/airplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open_native_window' }),
      });
    } catch {}
  };

  const serverReady = status.running;

  return (
    <main className="deviceStage">
      <section className="iphone">
        <div className="sideButton volumeUp" />
        <div className="sideButton volumeDown" />
        <div className="powerButton" />

        <div className="screen" onClick={handleFocusNative} style={{ cursor: 'pointer' }}>
          <img
            src={frameSrc}
            alt="AirPlay 2 Live Mirror"
            className="video"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />

          <div className="dynamicIsland">
            <div className="camera" />
          </div>

          <div className="status">
            <span className="liveDot" />
            {serverReady
              ? 'AIRPLAY 2 LISTO · 60 FPS · AUDIO EN CELULAR'
              : 'INICIANDO RECEPTOR AIRPLAY 2...'}
          </div>
        </div>
      </section>
    </main>
  );
}
