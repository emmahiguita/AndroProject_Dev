// ============================================================================
// ARCHIVO: page.tsx (/camera)
// QUÉ HACE: Página de transmisión de cámara por WebRTC con vista local,
//           cambio de cámara (trasera/frontal/webcam), captura PNG, estado
//           de Vision Backend (:8000), retorno procesado y grabación WebM.
// CÓMO FUNCIONA: Consume `useCameraWebRtc` y compone `CameraMetricsGrid`,
//           `CameraReconnectingBanner` y `CameraActivityLogs`.
// POR QUÉ: Inyectar lógica completa en `/camera` manteniendo < 200 líneas (SRP).
// ============================================================================

'use client';

import { Camera, Video, Link2, Play, Square, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCameraWebRtc } from './useCameraWebRtc';
import { CameraActivityLogs, CameraMetricsGrid, CameraReconnectingBanner } from './CameraMetricsAndLogs';

export default function CameraTransmitter() {
  const {
    stream, active, serverUrl, setServerUrl, facingMode, cameras, selectedDeviceId, backendHealth,
    logs, reconnecting, isRecording, metrics, videoRef, remoteVideoRef,
    startCamera, stopCamera, switchCamera, startStream, startRecording, stopRecording, takeSnapshot, refreshHealth,
  } = useCameraWebRtc();

  return (
    <div className="h-dvh overflow-y-auto bg-surface-root p-4 text-text-primary">
      <header className="mx-auto mb-5 flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 border-b border-border py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <a href="/?nav=dashboard" className="inline-flex min-h-9 shrink-0 items-center rounded-md border border-border-control bg-surface-card px-3 text-xs font-semibold hover:bg-surface-overlay">← Estudio</a>
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-overlay text-text-secondary">
            <Camera size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">Cámara WebRTC</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshHealth()}
            title="Comprobar Vision Backend (:8000)"
            className="flex min-h-9 items-center gap-2 rounded-md border border-border-control bg-surface-card px-3 text-xs font-semibold hover:bg-surface-overlay"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${backendHealth.online ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
            {backendHealth.online ? `Vision ${backendHealth.backend.toUpperCase()}` : 'Vision sin conexión'}
          </button>
          <div className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface-card px-3 text-text-secondary">
            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : reconnecting ? 'bg-amber-500 animate-pulse' : 'bg-zinc-600'}`} />
            <span className="text-xs font-medium">
              {active ? 'Transmitiendo' : reconnecting ? 'Reconectando...' : 'Inactivo'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className={`grid gap-4 ${stream ? 'sm:grid-cols-2' : ''}`}>
          <section className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-zinc-950 shadow-sm">
            <span className="absolute left-3 top-3 z-10 rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-300 backdrop-blur">
              Vista local
            </span>
            {stream && (
              <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={takeSnapshot}
                  title="Capturar fotografía PNG"
                  className="rounded-full border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 px-2.5 py-1 text-[9px] font-semibold text-zinc-200 flex items-center gap-1 backdrop-blur cursor-pointer"
                >
                  <ImageIcon size={11} /> Foto
                </button>
                <button
                  type="button"
                  onClick={() => void switchCamera()}
                  title="Alternar cámara trasera / frontal"
                  className="rounded-full border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 px-2.5 py-1 text-[9px] font-semibold text-zinc-200 flex items-center gap-1 backdrop-blur cursor-pointer"
                >
                  <RefreshCw size={11} /> {facingMode === 'environment' ? 'Trasera' : 'Frontal'}
                </button>
              </div>
            )}
            {stream ? (
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-zinc-500">
                <div>
                  <Video size={36} className="mx-auto mb-3 text-zinc-400" />
                  <p className="text-xs font-semibold text-zinc-300">Cámara apagada</p>
                  <p className="mt-1 text-xs text-zinc-400">Inicia la cámara para preparar la transmisión.</p>
                </div>
              </div>
            )}
          </section>

          {stream && (
            <section className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-zinc-950 shadow-sm">
              <span className="absolute left-3 top-3 z-10 rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-300 backdrop-blur">
                Retorno del PC
              </span>
              <video ref={remoteVideoRef} autoPlay playsInline controls className="h-full w-full object-contain" />
              {!active && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 px-6 text-center">
                  <p className="text-[11px] font-medium text-zinc-400">
                    {backendHealth.online
                      ? 'Pulsa «Conectar» para recibir el video procesado.'
                      : 'Inicia Vision Backend (puerto 8000) para conectar por WebRTC.'}
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        {active && <CameraMetricsGrid metrics={metrics} />}
        {reconnecting && <CameraReconnectingBanner />}

        <div className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface-card p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Link2 size={14} /> Conexión
          </h2>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="camera-server" className="text-xs font-semibold text-text-secondary">Servidor de destino</label>
            <input
              id="camera-server" type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
              className="h-10 rounded-md border border-border-control bg-surface-base px-3 font-mono text-sm text-text-primary placeholder:text-text-tertiary"
              placeholder="http://<IP-DE-TU-PC>:8000/vision/offer"
            />
          </div>

          {cameras.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="camera-source" className="text-xs font-semibold text-text-secondary">Dispositivo de cámara ({cameras.length})</label>
              <select
                id="camera-source" value={selectedDeviceId}
                onChange={(e) => void switchCamera(e.target.value)}
                className="h-10 rounded-md border border-border-control bg-surface-base px-3 text-sm text-text-primary"
              >
                <option value="">Automático ({facingMode === 'environment' ? 'Trasera' : 'Frontal'})</option>
                {cameras.map((c, idx) => (
                  <option key={c.deviceId || idx} value={c.deviceId}>{c.label || `Cámara ${idx + 1}`}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!stream ? (
              <Button onClick={startCamera} icon={<Play size={16} />}>Iniciar cámara</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={stopCamera} icon={<Square size={16} />}>Apagar cámara</Button>
                {!active && !reconnecting && (
                  <Button onClick={startStream} icon={<Play size={16} />}>Conectar</Button>
                )}
              </>
            )}
          </div>
          {stream && (
            <Button variant={isRecording ? 'danger' : 'secondary'} fullWidth
              onClick={isRecording ? stopRecording : startRecording}
            >
              <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-rose-400' : 'bg-rose-500'}`} />
              {isRecording ? 'Detener grabación (Guardar WebM)' : 'Grabar video (WebM)'}
            </Button>
          )}
        </div>

        <CameraActivityLogs logs={logs} />
      </main>
    </div>
  );
}
