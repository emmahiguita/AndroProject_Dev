// ============================================================================
// ARCHIVO: page.tsx (/camera)
// QUÉ HACE: Página de transmisión de cámara trasera por WebRTC con vista local,
//           retorno procesado desde PC, métricas en vivo y grabación WebM.
// CÓMO FUNCIONA: Consume `useCameraWebRtc` para todo el estado/streams y
//           compone `CameraMetricsGrid`, `CameraReconnectingBanner` y `CameraActivityLogs`.
// POR QUÉ: Reducir `camera/page.tsx` de 691 líneas a < 140 líneas (SRP).
// ============================================================================

'use client';

import { Camera, Video, Link2, Play, Square } from 'lucide-react';
import { useCameraWebRtc } from './useCameraWebRtc';
import {
  CameraActivityLogs,
  CameraMetricsGrid,
  CameraReconnectingBanner,
} from './CameraMetricsAndLogs';

export default function CameraTransmitter() {
  const {
    stream, active, serverUrl, setServerUrl, logs, reconnecting, isRecording, metrics,
    videoRef, remoteVideoRef, startCamera, stopCamera, startStream, startRecording, stopRecording,
  } = useCameraWebRtc();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans p-4">
      <header className="max-w-md mx-auto w-full py-4 flex items-center justify-between border-b border-zinc-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200">
            <Camera size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-zinc-100">AndroProject Cámara</h1>
            <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Transmisión WebRTC</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-900/90 rounded-full px-2.5 py-1 border border-zinc-800">
          <span className={`w-1.5 h-1.5 rounded-full ${
            active ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse' : reconnecting ? 'bg-amber-500 animate-pulse' : 'bg-zinc-600'
          }`} />
          <span className="text-[9px] font-medium tracking-wide text-zinc-300">
            {active ? 'Transmitiendo' : reconnecting ? 'Reconectando...' : 'Inactivo'}
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full flex flex-col gap-5">
        <div className="grid gap-4">
          <section className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-xl">
            <span className="absolute left-3 top-3 z-10 rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-300 backdrop-blur">
              Vista local
            </span>
            {stream ? (
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-zinc-500">
                <div>
                  <Video size={44} className="mx-auto mb-3 opacity-20 text-zinc-400" />
                  <p className="text-xs font-semibold text-zinc-300">Cámara apagada</p>
                  <p className="mt-1 text-[10px] text-zinc-500">Inicia la cámara para preparar la transmisión.</p>
                </div>
              </div>
            )}
          </section>

          {stream && (
            <section className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-xl">
              <span className="absolute left-3 top-3 z-10 rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-300 backdrop-blur">
                Retorno del PC
              </span>
              <video ref={remoteVideoRef} autoPlay playsInline controls className="h-full w-full object-contain" />
              {!active && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 px-6 text-center">
                  <p className="text-[11px] font-medium text-zinc-400">
                    Conecta con el servidor para ver aquí el video procesado.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        {active && <CameraMetricsGrid metrics={metrics} />}
        {reconnecting && <CameraReconnectingBanner />}

        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
          <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Link2 size={14} /> Conexión
          </h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Servidor de destino</label>
            <input
              type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500 transition-colors"
              placeholder="http://<IP-DE-TU-PC>:8000/vision/offer"
            />
          </div>
          <div className="flex gap-3">
            {!stream ? (
              <button onClick={startCamera} className="flex-1 bg-zinc-100 hover:bg-zinc-200 active:scale-[0.98] text-zinc-900 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm">
                <Play size={14} /> Iniciar cámara
              </button>
            ) : (
              <>
                <button onClick={stopCamera} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all">
                  <Square size={14} /> Apagar
                </button>
                {!active && !reconnecting && (
                  <button onClick={startStream} className="flex-1 bg-zinc-100 hover:bg-zinc-200 active:scale-[0.98] text-zinc-900 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm">
                    <Play size={14} /> Conectar
                  </button>
                )}
              </>
            )}
          </div>
          {active && (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-full py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                isRecording
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 animate-pulse shadow-sm shadow-red-500/20'
                  : 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-400' : 'bg-zinc-500'}`} />
              {isRecording ? 'Detener grabación' : 'Grabar video (WebM)'}
            </button>
          )}
        </div>

        <CameraActivityLogs logs={logs} />
      </main>
    </div>
  );
}
