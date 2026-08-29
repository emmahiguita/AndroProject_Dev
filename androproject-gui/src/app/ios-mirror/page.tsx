'use client';

import { useEffect, useRef, useState } from 'react';
import './ios-mirror.css';

export default function IOSMirrorPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [connected, setConnected] = useState(false);
  const [resolution, setResolution] = useState('');
  const [fps, setFps] = useState<number>(60);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 60, max: 60 },
          },
          audio: false,
        });

        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setConnected(true);

        videoRef.current.onloadedmetadata = () => {
          if (!videoRef.current) return;
          setResolution(
            `${videoRef.current.videoWidth} × ${videoRef.current.videoHeight}`
          );
        };

        const track = stream.getVideoTracks()[0];
        track.onended = () => {
          setConnected(false);
        };

        // Real-time FPS counter
        const countFrames = () => {
          frameCount++;
          const now = performance.now();
          if (now - lastTime >= 1000) {
            setFps(Math.round((frameCount * 1000) / (now - lastTime)));
            frameCount = 0;
            lastTime = now;
          }
          animId = requestAnimationFrame(countFrames);
        };
        animId = requestAnimationFrame(countFrames);

      } catch (error) {
        console.error('No se pudo iniciar AirPlay Clean Feed:', error);
        setConnected(false);
      }
    }

    start();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  return (
    <main className="deviceStage">
      <section className="iphone">
        <div className="sideButton volumeUp" />
        <div className="sideButton volumeDown" />
        <div className="powerButton" />
        
        <div className="screen">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="video"
          />

          <div className="dynamicIsland">
            <div className="camera" />
          </div>

          {!connected && (
            <div className="waiting">
              <div className="spinner" />
              <strong>Esperando iPhone</strong>
              <span>
                Centro de Control<br />
                Duplicar Pantalla<br />
                <span className="highlight">AndroProject [PC]</span>
              </span>
            </div>
          )}

          {connected && (
            <div className="status">
              <span className="liveDot" />
              LIVE · {fps} FPS {resolution && `· ${resolution}`}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
