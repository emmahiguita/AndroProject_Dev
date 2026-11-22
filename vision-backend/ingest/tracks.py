# ============================================================================
# ARCHIVO: tracks.py
# QUÉ HACE: Define los tracks WebRTC de video (`VideoTransformTrack`) y audio
#           pass-through (`AudioPassThroughTrack`) para Vision Backend.
# CÓMO FUNCIONA: Recibe frames de `aiortc`, ejecuta el procesamiento OpenCV
#           (`process_frame`) fuera del event loop usando `asyncio.to_thread`
#           para evitar bloqueos y reporta telemetría real de FPS/latencia.
# POR QUÉ: Separar los tracks de `webrtc.py` cumple SRP (< 200 líneas) y
#           elimina el cuello de botella síncrono que congelaba el event loop.
# ============================================================================

import asyncio
import logging
import time
from aiortc import MediaStreamTrack
from av import VideoFrame
from processing.denoise import process_frame, CUDA_AVAILABLE

logger = logging.getLogger(__name__)


class VideoTransformTrack(MediaStreamTrack):
    """Track de video WebRTC con procesamiento OpenCV no bloqueante y telemetría."""

    kind = "video"

    def __init__(self, track):
        super().__init__()
        self.track = track
        self.frame_count = 0
        self.total_process_time = 0.0
        self.max_process_time = 0.0
        self.last_report_time = time.monotonic()
        self.report_interval = 5.0

    async def recv(self):
        try:
            frame = await self.track.recv()
        except Exception as e:
            logger.debug(f"[VIDEO] Stream track ended/closed: {e}")
            raise

        t_start = time.perf_counter()

        # Convertir y procesar fuera del event loop para no bloquear otras conexiones WebRTC
        img = frame.to_ndarray(format="bgr24")
        processed_img = await asyncio.to_thread(process_frame, img)

        process_ms = (time.perf_counter() - t_start) * 1000
        self.frame_count += 1
        self.total_process_time += process_ms
        if process_ms > self.max_process_time:
            self.max_process_time = process_ms

        now = time.monotonic()
        if now - self.last_report_time >= self.report_interval and self.frame_count > 0:
            avg_ms = self.total_process_time / self.frame_count
            fps = self.frame_count / (now - self.last_report_time)
            logger.info(
                f"[VIDEO] FPS={fps:.1f} | Procesamiento avg={avg_ms:.1f}ms "
                f"max={self.max_process_time:.1f}ms | "
                f"Res={img.shape[1]}x{img.shape[0]} | "
                f"GPU={'CUDA' if CUDA_AVAILABLE else 'CPU'}"
            )
            self.frame_count = 0
            self.total_process_time = 0.0
            self.max_process_time = 0.0
            self.last_report_time = now

        new_frame = VideoFrame.from_ndarray(processed_img, format="bgr24")
        new_frame.pts = frame.pts
        new_frame.time_base = frame.time_base
        return new_frame


class AudioPassThroughTrack(MediaStreamTrack):
    """Track de audio ligero en pass-through para evitar bucles de realimentación."""

    kind = "audio"

    def __init__(self, track):
        super().__init__()
        self.track = track
        self.frame_count = 0
        self.last_report_time = time.monotonic()

    async def recv(self):
        try:
            frame = await self.track.recv()
        except Exception as e:
            logger.debug(f"[AUDIO] Stream track ended/closed: {e}")
            raise
        self.frame_count += 1
        now = time.monotonic()
        if now - self.last_report_time >= 10.0 and self.frame_count > 0:
            logger.info(f"[AUDIO] Frames recibidos: {self.frame_count} | Audio fluyendo correctamente")
            self.frame_count = 0
            self.last_report_time = now
        return frame
