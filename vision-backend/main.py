# ============================================================================
# ARCHIVO: main.py
# QUÉ HACE: Punto de entrada FastAPI para el servidor Vision Backend (WebRTC,
#           healthcheck y WebSocket de runtime).
# CÓMO FUNCIONA: Configura CORS por entorno, monta `/vision/offer` y usa
#           `lifespan` para cerrar todas las conexiones WebRTC al apagar.
# POR QUÉ: Evitar sockets/tareas zombis en shutdown y mantener código limpio.
# ============================================================================

import logging
import os
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router as api_router
from ingest.webrtc import close_all_connections, get_active_connection_count
from processing.denoise import CUDA_AVAILABLE

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)-7s %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("vision-backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestiona inicio y cierre determinista de recursos WebRTC."""
    logger.info("=" * 60)
    logger.info("AndroProject Vision Backend v2.1.0 iniciando...")
    logger.info(f"GPU/CUDA: {'HABILITADO' if CUDA_AVAILABLE else 'CPU ONLY'}")
    if not CUDA_AVAILABLE:
        logger.info("  El filtro CPU procesa ~2ms/frame en 4K")
    logger.info("Audio: WebRTC pass-through (AudioPassThroughTrack)")
    logger.info("=" * 60)
    yield
    await close_all_connections()
    logger.info("Vision Backend detenido limpiamente.")


app = FastAPI(
    title="AndroProject Vision Backend",
    description="GPU-accelerated vision backend for processing WebRTC/Scrcpy streams",
    version="2.1.0",
    lifespan=lifespan,
)

_CORS_ORIGINS = os.environ.get(
    "FRONTEND_ORIGIN",
    "http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3001,http://localhost:3001",
)
_ALLOWED_ORIGINS = [o.strip() for o in _CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info(f"CORS allow_origins={_ALLOWED_ORIGINS}")

app.include_router(api_router, prefix="/vision")


@app.get("/")
async def root():
    return {"message": "Vision Backend is running", "version": "2.1.0"}


@app.get("/health")
async def health_check():
    """Endpoint de salud: estado CUDA/CPU y conexiones WebRTC activas."""
    return {
        "status": "healthy",
        "gpu": {
            "cuda_available": CUDA_AVAILABLE,
            "backend": "cuda" if CUDA_AVAILABLE else "cpu",
            "filter": "gaussian_blur_3x3 + unsharp_mask",
        },
        "webrtc": {
            "active_connections": get_active_connection_count(),
        },
        "version": "2.1.0",
    }


@app.websocket("/ws/browser-runtime")
async def websocket_browser_runtime(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket /ws/browser-runtime conectado")
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"echo: {data}")
    except WebSocketDisconnect:
        logger.info("WebSocket /ws/browser-runtime desconectado")
    except Exception as e:
        logger.warning(f"WebSocket /ws/browser-runtime cerrado: {e}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
