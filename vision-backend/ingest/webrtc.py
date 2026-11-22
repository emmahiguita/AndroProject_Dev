# ============================================================================
# ARCHIVO: webrtc.py
# QUÉ HACE: Gestiona el ciclo de vida de conexiones WebRTC (`RTCPeerConnection`),
#           servidores STUN/TURN reales y limpieza de conexiones huérfanas.
# CÓMO FUNCIONA: Construye `RTCConfiguration(iceServers=...)` en el constructor
#           de `RTCPeerConnection`, adjunta `VideoTransformTrack` y
#           `AudioPassThroughTrack`, y mantiene referencia fuerte al task de GC.
# POR QUÉ: Corregir el bug donde `pc._iceServers` era ignorado por `aiortc`,
#           prevenir fugas de tareas asyncio y mantener SRP (< 200 líneas).
# ============================================================================

import asyncio
import logging
import os
from typing import Optional
from aiortc import (
    MediaStreamTrack,
    RTCConfiguration,
    RTCIceServer,
    RTCPeerConnection,
    RTCSessionDescription,
)
from processing.denoise import CUDA_AVAILABLE
from ingest.tracks import AudioPassThroughTrack, VideoTransformTrack

logger = logging.getLogger(__name__)

_pcs: set = set()
_cleanup_task: Optional[asyncio.Task] = None


def get_active_connection_count() -> int:
    """Devuelve el número de conexiones WebRTC activas."""
    return len(_pcs)


def get_active_connections() -> set:
    """Devuelve una copia de solo lectura del conjunto de conexiones activas."""
    return set(_pcs)


def _build_ice_configuration() -> RTCConfiguration:
    """Construye la configuración oficial STUN/TURN aceptada por aiortc."""
    servers = [
        RTCIceServer(urls=["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]),
    ]
    turn_url = os.environ.get("TURN_SERVER_URL", "").strip()
    if turn_url:
        servers.append(
            RTCIceServer(
                urls=[turn_url],
                username=os.environ.get("TURN_USERNAME", ""),
                credential=os.environ.get("TURN_CREDENTIAL", ""),
            )
        )
        logger.info(f"TURN server configured: {turn_url}")
    return RTCConfiguration(iceServers=servers)


async def _cleanup_stale_connections():
    """Cierra periódicamente conexiones en estado failed/closed cada 30s."""
    global _cleanup_task
    try:
        while True:
            await asyncio.sleep(30)
            dead = [pc for pc in list(_pcs) if pc.connectionState in ("failed", "closed")]
            for pc in dead:
                logger.warning(f"Cleaning up stale connection in state '{pc.connectionState}'")
                _pcs.discard(pc)
                try:
                    await pc.close()
                except Exception:
                    pass
            if dead:
                logger.info(f"Stale cleanup: removed {len(dead)} connections, {len(_pcs)} remaining")
    finally:
        _cleanup_task = None


async def handle_offer(sdp: str, type: str) -> RTCSessionDescription:
    """Procesa una oferta SDP entrante y retorna la respuesta SDP local."""
    global _cleanup_task
    offer = RTCSessionDescription(sdp=sdp, type=type)
    pc = RTCPeerConnection(configuration=_build_ice_configuration())
    _pcs.add(pc)

    if _cleanup_task is None or _cleanup_task.done():
        _cleanup_task = asyncio.create_task(_cleanup_stale_connections())

    logger.info(f"GPU status: {'CUDA enabled' if CUDA_AVAILABLE else 'CPU only (CUDA not available)'}")

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        state = pc.connectionState
        logger.info(f"Connection state -> {state}")
        if state in ("failed", "closed"):
            _pcs.discard(pc)
            try:
                await pc.close()
            except Exception:
                pass
            logger.info(f"Active connections remaining: {len(_pcs)}")

    @pc.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange():
        ice_state = pc.iceConnectionState
        # "disconnected" es transitorio en WebRTC: solo cerrar en failed/closed
        if ice_state in ("failed", "closed"):
            logger.info(f"ICE state -> {ice_state}, closing peer connection")
            _pcs.discard(pc)
            try:
                await pc.close()
            except Exception:
                pass

    @pc.on("track")
    def on_track(track: MediaStreamTrack):
        logger.info(f"Track received: kind={track.kind}, id={track.id}")
        if track.kind == "video":
            pc.addTrack(VideoTransformTrack(track))
            logger.info("Video processing pipeline established")
        elif track.kind == "audio":
            pc.addTrack(AudioPassThroughTrack(track))
            logger.info("Audio pass-through established (not blackholed)")

    try:
        await pc.setRemoteDescription(offer)
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        logger.info(f"SDP answer ready. sdp length={len(answer.sdp)}")
        return pc.localDescription
    except Exception as e:
        logger.error(f"Failed to handle WebRTC offer: {e}")
        _pcs.discard(pc)
        try:
            await pc.close()
        except Exception:
            pass
        raise


async def close_all_connections() -> None:
    """Cierra ordenadamente todas las conexiones WebRTC y el task de limpieza al apagar."""
    global _cleanup_task
    if _cleanup_task and not _cleanup_task.done():
        _cleanup_task.cancel()
        try:
            await _cleanup_task
        except asyncio.CancelledError:
            pass
    _cleanup_task = None
    active = list(_pcs)
    _pcs.clear()
    if active:
        await asyncio.gather(*(pc.close() for pc in active), return_exceptions=True)
        logger.info(f"Closed {len(active)} active WebRTC peer connection(s) on shutdown.")
