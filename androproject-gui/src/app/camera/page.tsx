'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Video, Link2, Play, Square, RefreshCw } from 'lucide-react';

type InboundVideoStats = RTCStats & {
  kind?: string;
  bytesReceived?: number;
  framesPerSecond?: number;
  packetsLost?: number;
  jitter?: number;
  frameWidth?: number;
  frameHeight?: number;
};

type CandidatePairStats = RTCStats & {
  state?: string;
  currentRoundTripTime?: number;
};

type TurnServer = {
  url: string;
  username?: string;
  credential?: string;
};

type RuntimeWindow = Window & {
  _env?: { TURN_SERVERS?: TurnServer[] };
};

type EncodingWithPriority = RTCRtpEncodingParameters & {
  networkPriority?: 'very-low' | 'low' | 'medium' | 'high';
};

const DEFAULT_SERVER_URL = 'http://127.0.0.1:8000/vision/offer';
const MAX_ICE_RETRIES = 3;
const MAX_RECONNECT_ATTEMPTS = 5;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
export default function CameraTransmitter() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [logs, setLogs] = useState<string[]>([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // ── Métricas en tiempo real ─────────────────────────────────────────
  const [metrics, setMetrics] = useState({
    fps: 0,
    bitrate: 0,
    packetsLost: 0,
    jitter: 0,
    resolution: '',
    latencyMs: 0,
  });
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBytesRef = useRef(0);
  const lastStatsTimeRef = useRef(0);
  const iceFailCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const attemptFullReconnectionRef = useRef<() => void>(() => {});

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 30));
  }, []);

  // Get local IP helper suggestion on mount
  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return;
    const updateUrl = setTimeout(() => {
      setServerUrl(`http://${hostname}:8000/vision/offer`);
    }, 0);
    return () => clearTimeout(updateUrl);
  }, []);

  // Limpiar timers, recorder y peer connection al desmontar
  useEffect(() => {
    return () => {
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      remoteStreamRef.current = null;
    };
  }, []);

  // ── Recolección de métricas WebRTC ──────────────────────────────────
  const startStatsCollection = useCallback(() => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);

    statsIntervalRef.current = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc || pc.connectionState !== 'connected') return;

      try {
        const stats = await pc.getStats();
        const reports: RTCStats[] = [];
        stats.forEach(report => reports.push(report as RTCStats));
        const inboundVideo = reports
          .filter(report => report.type === 'inbound-rtp')
          .map(report => report as InboundVideoStats)
          .find(report => report.kind === 'video');
        const candidatePair = reports
          .filter(report => report.type === 'candidate-pair')
          .map(report => report as CandidatePairStats)
          .find(report => report.state === 'succeeded');
        const latencyMs = typeof candidatePair?.currentRoundTripTime === 'number'
          ? Math.round(candidatePair.currentRoundTripTime * 1000)
          : undefined;

        if (inboundVideo) {
          // CORREGIDO: cálculo delta de bitrate (antes usaba bytesReceived acumulado / 125000)
          const now = Date.now();
          const bytes = inboundVideo.bytesReceived || 0;
          let bitrate = 0;
          if (lastBytesRef.current > 0 && lastStatsTimeRef.current > 0 && bytes > lastBytesRef.current) {
            const deltaBytes = bytes - lastBytesRef.current;
            const deltaSec = (now - lastStatsTimeRef.current) / 1000;
            bitrate = Math.round((deltaBytes * 8) / deltaSec / 1_000_000); // Mbps
          }
          lastBytesRef.current = bytes;
          lastStatsTimeRef.current = now;

          setMetrics(prev => ({
            fps: Math.round(inboundVideo.framesPerSecond || 0),
            bitrate,
            packetsLost: inboundVideo.packetsLost || 0,
            jitter: Math.round((inboundVideo.jitter || 0) * 1000),
            resolution: `${inboundVideo.frameWidth || '?'}×${inboundVideo.frameHeight || '?'}`,
            latencyMs: latencyMs ?? prev.latencyMs,
          }));
        }
      } catch {
        // getStats puede fallar en ciertos estados, ignorar silenciosamente
      }
    }, 3000);
  }, []);

  const resetMetrics = useCallback(() => {
    setMetrics({ fps: 0, bitrate: 0, packetsLost: 0, jitter: 0, resolution: '', latencyMs: 0 });
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }, []);

  // ── Cámara ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async (): Promise<MediaStream | null> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Este navegador no permite acceder a la cámara.');
      }

      addLog('Solicitando acceso a la cámara trasera con audio...');
      streamRef.current?.getTracks().forEach(track => track.stop());

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 3840, min: 1280 },
          height: { ideal: 2160, min: 720 },
          frameRate: { ideal: 60, min: 30 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2,
        },
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true;
      }

      mediaStream.getTracks().forEach(track => {
        track.onended = () => {
          if (streamRef.current !== mediaStream) return;
          const hasLiveTrack = mediaStream.getTracks().some(item => item.readyState === 'live');
          if (!hasLiveTrack) {
            streamRef.current = null;
            setStream(null);
            setActive(false);
          }
        };
      });

      const videoSettings = mediaStream.getVideoTracks()[0]?.getSettings();
      const audioSettings = mediaStream.getAudioTracks()[0]?.getSettings();
      addLog(`Cámara ${videoSettings?.width ?? '?'}×${videoSettings?.height ?? '?'} a ${videoSettings?.frameRate ?? '?'} FPS · Audio ${audioSettings?.sampleRate ?? '?'} Hz`);
      iceFailCountRef.current = 0;
      reconnectAttemptRef.current = 0;
      return mediaStream;
    } catch (error: unknown) {
      addLog(`No se pudo iniciar la cámara: ${getErrorMessage(error)}`);
      return null;
    }
  }, [addLog]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const stopCamera = useCallback(() => {
    setReconnecting(false);
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;

    stopRecording();
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setStream(null);

    if (videoRef.current) videoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteStreamRef.current = null;

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    setActive(false);
    resetMetrics();
    lastBytesRef.current = 0;
    lastStatsTimeRef.current = 0;
    iceFailCountRef.current = 0;
    addLog('Transmisión y cámara detenidas.');
  }, [addLog, resetMetrics, stopRecording]);

  const startRecording = useCallback(() => {
    const remoteStream = remoteStreamRef.current;
    if (!remoteStream || remoteStream.getVideoTracks().length === 0) {
      addLog('Aun no hay video remoto disponible para grabar.');
      return;
    }

    try {
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm';
      }

      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(remoteStream, {
        mimeType,
        videoBitsPerSecond: 10_000_000,
      });
      recorder.ondataavailable = event => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setIsRecording(false);
        if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          addLog('La grabacion termino sin datos.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `androproject_grabacion_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        addLog(`Grabacion guardada (${(blob.size / 1024 / 1024).toFixed(1)} MB).`);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (error: unknown) {
      addLog(`No se pudo iniciar la grabación: ${getErrorMessage(error)}`);
    }
  }, [addLog]);

  const establishConnection = useCallback(async (): Promise<void> => {
    const localStream = streamRef.current;
    if (!localStream || localStream.getTracks().every(track => track.readyState === 'ended')) {
      throw new Error('La cámara no tiene un stream activo.');
    }

    let endpoint: URL;
    try {
      endpoint = new URL(serverUrl);
    } catch {
      throw new Error('La dirección del servidor no es válida.');
    }
    if (!['http:', 'https:'].includes(endpoint.protocol)) {
      throw new Error('El servidor debe usar HTTP o HTTPS.');
    }

    addLog(`Conectando con ${endpoint.host}...`);
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
    }

    const configuredTurn = (window as RuntimeWindow)._env?.TURN_SERVERS ?? [];
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        ...configuredTurn.filter(server => server.url).map(server => ({
          urls: server.url,
          username: server.username,
          credential: server.credential,
        })),
      ],
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 0,
    };

    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;

    localStream.getTracks().forEach(track => {
      const sender = pc.addTrack(track, localStream);
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      const encoding = params.encodings[0] as EncodingWithPriority;
      if (track.kind === 'video') {
        encoding.maxBitrate = 20_000_000;
        encoding.maxFramerate = 60;
        encoding.networkPriority = 'high';
      } else {
        encoding.maxBitrate = 192_000;
      }
      void sender.setParameters(params).catch(() => {});
    });

    pc.ontrack = event => {
      if (remoteStreamRef.current !== remoteStream) return;
      if (!remoteStream.getTracks().some(track => track.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        if (event.track.kind === 'audio') remoteVideoRef.current.muted = false;
        void remoteVideoRef.current.play().catch(() => {});
      }
      addLog(event.track.kind === 'video'
        ? 'Video procesado recibido.'
        : 'Audio remoto recibido.');
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      addLog(`ICE: ${state}`);

      if (state === 'connected' || state === 'completed') {
        setActive(true);
        setReconnecting(false);
        reconnectAttemptRef.current = 0;
        iceFailCountRef.current = 0;
        addLog('Transmisión WebRTC activa.');
        startStatsCollection();
      } else if (state === 'disconnected') {
        setActive(false);
        addLog('Conexión temporalmente interrumpida; WebRTC intentará recuperarla.');
      } else if (state === 'failed') {
        setActive(false);
        iceFailCountRef.current += 1;
        addLog(`ICE falló (${iceFailCountRef.current}/${MAX_ICE_RETRIES}).`);
        if (iceFailCountRef.current <= MAX_ICE_RETRIES) pc.restartIce();
        setTimeout(() => {
          if (pcRef.current === pc && pc.iceConnectionState === 'failed') {
            attemptFullReconnectionRef.current();
          }
        }, 2000);
      } else if (state === 'closed') {
        setActive(false);
        resetMetrics();
        iceFailCountRef.current = 0;
      }
    };

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    const sdp = (offer.sdp ?? '').replace(/b=AS:\d+/g, 'b=AS:20000');
    await pc.setLocalDescription({ type: offer.type, sdp });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sdp: pc.localDescription?.sdp,
        type: pc.localDescription?.type,
      }),
    });
    if (!response.ok) {
      throw new Error(`El servidor respondió ${response.status}: ${response.statusText}`);
    }

    const answer = await response.json() as RTCSessionDescriptionInit;
    if (answer.type !== 'answer' || typeof answer.sdp !== 'string') {
      throw new Error('El servidor devolvió una respuesta SDP inválida.');
    }
    await pc.setRemoteDescription(answer);
    addLog('Negociación WebRTC completada.');
  }, [addLog, resetMetrics, serverUrl, startStatsCollection]);

  const attemptFullReconnection = useCallback(() => {
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      addLog(`Se alcanzó el límite de ${MAX_RECONNECT_ATTEMPTS} reconexiones.`);
      stopCamera();
      return;
    }

    reconnectAttemptRef.current += 1;
    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(1000 * 2 ** (attempt - 1), 30000);
    setReconnecting(true);
    addLog(`Reconectando en ${delay / 1000} s (${attempt}/${MAX_RECONNECT_ATTEMPTS})...`);

    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(async () => {
      try {
        let currentStream = streamRef.current;
        if (!currentStream || currentStream.getTracks().every(track => track.readyState === 'ended')) {
          addLog('El stream local terminó; reiniciando la cámara...');
          currentStream = await startCamera();
        }
        if (!currentStream || currentStream.getTracks().every(track => track.readyState === 'ended')) {
          throw new Error('No se pudo recuperar el stream de cámara.');
        }
        await establishConnection();
      } catch (error: unknown) {
        addLog(`Reconexión fallida: ${getErrorMessage(error)}`);
        attemptFullReconnectionRef.current();
      }
    }, delay);
  }, [addLog, establishConnection, startCamera, stopCamera]);

  useEffect(() => {
    attemptFullReconnectionRef.current = attemptFullReconnection;
    return () => {
      attemptFullReconnectionRef.current = () => {};
    };
  }, [attemptFullReconnection]);

  const startStream = useCallback(async () => {
    if (!streamRef.current) {
      addLog('Inicia la cámara primero.');
      return;
    }

    setReconnecting(false);
    reconnectAttemptRef.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    try {
      await establishConnection();
    } catch (error: unknown) {
      setActive(false);
      addLog(`No se pudo conectar: ${getErrorMessage(error)}`);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    }
  }, [addLog, establishConnection]);
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans p-4">
      {/* Header */}
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

      {/* Main content */}
      <main className="flex-1 max-w-md mx-auto w-full flex flex-col gap-5">
        <div className="grid gap-4">
          <section className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-xl">
            <span className="absolute left-3 top-3 z-10 rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-300 backdrop-blur">
              Vista local
            </span>
            {stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
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
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                controls
                className="h-full w-full object-contain"
              />
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

        {/* Panel de métricas en tiempo real */}
        {active && (
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 grid grid-cols-3 gap-3 shadow-xl backdrop-blur-sm">
            {[
              { label: 'FPS', value: metrics.fps, unit: '', color: 'text-zinc-100' },
              { label: 'Resolución', value: metrics.resolution, unit: '', color: 'text-zinc-200' },
              { label: 'Latencia', value: metrics.latencyMs, unit: 'ms', color: 'text-zinc-200' },
              { label: 'Pérdida', value: metrics.packetsLost, unit: 'pkg', color: metrics.packetsLost > 10 ? 'text-red-400' : 'text-zinc-400' },
              { label: 'Jitter', value: metrics.jitter, unit: 'ms', color: 'text-zinc-300' },
              { label: 'Bitrate', value: metrics.bitrate, unit: 'Mbps', color: 'text-zinc-200' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">{label}</span>
                <span className={`text-lg font-bold ${color} tabular-nums`}>
                  {typeof value === 'number' ? value : value || '--'}
                </span>
                {unit && <span className="text-[8px] text-zinc-500">{unit}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Reconexión indicator */}
        {reconnecting && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex items-center gap-3">
            <RefreshCw size={16} className="text-amber-400 animate-spin" />
            <span className="text-xs text-amber-400 font-bold">Reconectando automáticamente...</span>
          </div>
        )}

        {/* Server settings card */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
          <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Link2 size={14} /> Conexión
          </h2>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Servidor de destino</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500 transition-colors"
              placeholder="http://<IP-DE-TU-PC>:8000/vision/offer"
            />
          </div>

          <div className="flex gap-3">
            {!stream ? (
              <button
                onClick={startCamera}
                className="flex-1 bg-zinc-100 hover:bg-zinc-200 active:scale-[0.98] text-zinc-900 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <Play size={14} /> Iniciar cámara
              </button>
            ) : (
              <>
                <button
                  onClick={stopCamera}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <Square size={14} /> Apagar
                </button>
                
                {!active && !reconnecting && (
                  <button
                    onClick={startStream}
                    className="flex-1 bg-zinc-100 hover:bg-zinc-200 active:scale-[0.98] text-zinc-900 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <Play size={14} /> Conectar
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── Botón de grabación ── */}
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

        {/* Logs */}
        <div className="flex-1 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-2 min-h-[120px] max-h-[220px] overflow-y-auto">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Actividad de conexión</span>
          <div className="flex flex-col gap-1 text-[10px] font-mono text-zinc-400">
            {logs.length === 0 ? (
              <span className="text-zinc-600 italic">Sin actividad reciente.</span>
            ) : (
              logs.map((log, i) => {
                const lower = log.toLowerCase();
                const colorClass = (lower.includes('falló') || lower.includes('límite') || lower.includes('no se pudo'))
                  ? 'text-red-400'
                  : (lower.includes('activa') || lower.includes('completada') || lower.includes('recibido') || lower.includes('guardada'))
                  ? 'text-emerald-400'
                  : (lower.includes('interrumpida') || lower.includes('reiniciando') || lower.includes('reconectando'))
                  ? 'text-amber-400'
                  : 'text-zinc-400';

                return (
                  <div key={i} className={colorClass}>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
