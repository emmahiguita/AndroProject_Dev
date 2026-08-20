import uvicorn
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router as api_router
from processing.denoise import CUDA_AVAILABLE

# Configurar logging estructurado
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)-7s %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("vision-backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """CORREGIDO: lifespan en lugar de @app.on_event (deprecado en FastAPI)."""
    logger.info("=" * 60)
    logger.info("AndroProject Vision Backend v2.1.0 iniciando...")
    logger.info(f"GPU/CUDA: {'HABILITADO' if CUDA_AVAILABLE else 'CPU ONLY'}")
    if not CUDA_AVAILABLE:
        logger.info("  El filtro CPU procesa ~2ms/frame en 4K")
    logger.info("Audio: WebRTC pass-through (AudioPassThroughTrack)")
    logger.info("=" * 60)
    yield
    logger.info("Vision Backend detenido.")


app = FastAPI(
    title="AndroProject Vision Backend",
    description="GPU-accelerated vision backend for processing WebRTC/Scrcpy streams",
    version="2.1.0",
    lifespan=lifespan,
)

# ═══════════════════════════════════════════════════════════════════════════
# CORS: lee FRONTEND_ORIGIN del entorno, o permite explícitamente las URLs
# de desarrollo local. En producción, configurar FRONTEND_ORIGIN en las
# variables de entorno (p. ej. https://androproject.mi-dominio.com).
# ═══════════════════════════════════════════════════════════════════════════
import os

_CORS_ORIGINS = os.environ.get(
    "FRONTEND_ORIGIN", "http://127.0.0.1:3001,http://localhost:3001"
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
    """Endpoint de salud: CUDA, WebRTC, métricas básicas."""
    from ingest.webrtc import get_active_connection_count

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


from fastapi import WebSocket, WebSocketDisconnect

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
