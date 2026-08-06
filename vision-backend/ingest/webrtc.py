import logging
import asyncio
import time
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from av import VideoFrame
from processing.denoise import process_frame, CUDA_AVAILABLE

logger = logging.getLogger(__name__)

# Keep track of active peer connections with their stats
pcs = set()
_stale_cleanup_started = False


class VideoTransformTrack(MediaStreamTrack):
    """
    A video stream track that transforms frames from another track.
    Includes latency and performance telemetry.
    """

    kind = "video"

    def __init__(self, track):
        super().__init__()
        self.track = track
        # Performance counters
        self.frame_count = 0
        self.total_process_time = 0.0
        self.max_process_time = 0.0
        self.last_report_time = time.monotonic()
        self.report_interval = 5.0  # seconds

    async def recv(self):
        try:
            frame = await self.track.recv()
        except Exception as e:
            logger.debug(f"[VIDEO] Stream track ended/closed: {e}")
            raise

        t_start = time.perf_counter()

        # Convert av.VideoFrame to numpy array (BGR format for OpenCV)
        img = frame.to_ndarray(format="bgr24")

        # Process the frame (Denoise / GPU Acceleration)
        processed_img = process_frame(img)

        process_ms = (time.perf_counter() - t_start) * 1000
        self.frame_count += 1
        self.total_process_time += process_ms
        if process_ms > self.max_process_time:
            self.max_process_time = process_ms

        # Periodic performance report
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
            # Reset counters
            self.frame_count = 0
            self.total_process_time = 0.0
            self.max_process_time = 0.0
            self.last_report_time = now

        # Convert back to av.VideoFrame
        new_frame = VideoFrame.from_ndarray(processed_img, format="bgr24")
        new_frame.pts = frame.pts
        new_frame.time_base = frame.time_base
        return new_frame


class AudioPassThroughTrack(MediaStreamTrack):
    """
    A lightweight audio track that passes through audio frames
    without modification to avoid feedback loops.
    """

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
            logger.info(
                f"[AUDIO] Frames recibidos: {self.frame_count} | Audio fluyendo correctamente"
            )
            self.frame_count = 0
            self.last_report_time = now
        return frame


async def _cleanup_stale_connections():
    """Periodically close connections that have been orphaned for >30s."""
    global _stale_cleanup_started
    if _stale_cleanup_started:
        return
    _stale_cleanup_started = True
    try:
        while True:
            await asyncio.sleep(30)
            dead = [pc for pc in list(pcs) if pc.connectionState in ("failed", "closed")]
            for pc in dead:
                logger.warning(
                    f"Cleaning up stale connection in state '{pc.connectionState}'"
                )
                pcs.discard(pc)
                try:
                    await pc.close()
                except Exception:
                    pass
            if dead:
                logger.info(
                    f"Stale cleanup: removed {len(dead)} connections, {len(pcs)} remaining"
                )
    finally:
        _stale_cleanup_started = False


# ── ICE / TURN configuration ──────────────────────────────────────────
# For LAN: default STUN from Google is sufficient.
# For WAN / remote access: set TURN_SERVER_URL and TURN_CREDENTIAL env vars.
# If TURN is configured, it's used for NAT traversal when P2P fails.
ICE_SERVERS = [
    {"urls": "stun:stun.l.google.com:19302"},
    {"urls": "stun:stun1.l.google.com:19302"},
]
import os

_turn_url = os.environ.get("TURN_SERVER_URL", "")
_turn_user = os.environ.get("TURN_USERNAME", "")
_turn_cred = os.environ.get("TURN_CREDENTIAL", "")
if _turn_url:
    ICE_SERVERS.append(
        {
            "urls": _turn_url,
            "username": _turn_user,
            "credential": _turn_cred,
        }
    )
    logger.info(f"TURN server configured: {_turn_url}")


async def handle_offer(sdp: str, type: str) -> RTCSessionDescription:
    offer = RTCSessionDescription(sdp=sdp, type=type)
    pc = RTCPeerConnection()
    # Aplicar servidores ICE para NAT traversal
    pc._iceServers = ICE_SERVERS  # type: ignore[attr-defined]
    pcs.add(pc)

    # Start the stale connection cleanup loop (idempotent)
    asyncio.create_task(_cleanup_stale_connections())

    logger.info(
        f"GPU status: {'CUDA enabled' if CUDA_AVAILABLE else 'CPU only (CUDA not available)'}"
    )

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        state = pc.connectionState
        logger.info(f"Connection state -> {state}")
        if state in ("failed", "closed"):
            pcs.discard(pc)
            try:
                await pc.close()
            except Exception:
                pass
            # Notify about active connections remaining
            logger.info(f"Active connections remaining: {len(pcs)}")

    @pc.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange():
        ice_state = pc.iceConnectionState
        if ice_state in ("failed", "disconnected", "closed"):
            logger.info(f"ICE state -> {ice_state}, scheduling cleanup")
            pcs.discard(pc)
            try:
                await pc.close()
            except Exception:
                pass

    @pc.on("track")
    def on_track(track: MediaStreamTrack):
        logger.info(f"Track received: kind={track.kind}, id={track.id}")

        if track.kind == "video":
            # Apply OpenCV processing to the incoming video track
            local_video = VideoTransformTrack(track)
            # Send the processed video back to the sender
            pc.addTrack(local_video)
            logger.info("Video processing pipeline established")

        elif track.kind == "audio":
            local_audio = AudioPassThroughTrack(track)
            pc.addTrack(local_audio)
            logger.info("Audio pass-through established (not blackholed)")

    try:
        await pc.setRemoteDescription(offer)
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        logger.info(f"SDP answer ready. sdp length={len(answer.sdp)}")
        return pc.localDescription
    except Exception as e:
        logger.error(f"Failed to handle WebRTC offer: {e}")
        pcs.discard(pc)
        try:
            await pc.close()
        except Exception:
            pass
        raise
