# ============================================================================
# ARCHIVO: denoise.py
# QUÉ HACE: Aplica reducción de ruido Gaussiana + Unsharp Masking en tiempo
#           real sobre frames de video (acelerado por CUDA o fallback CPU).
# CÓMO FUNCIONA: Detecta OpenCV CUDA al importar, reutiliza `GpuMat` y
#           `cv2.cuda.createGaussianFilter` por hilo para evitar fugas de VRAM,
#           y degrada automáticamente a CPU (`cv2.GaussianBlur`) si falla GPU.
# POR QUÉ: Corregir la llamada inexistente `cv2.cuda.GaussianBlur` y mantener
#           un procesamiento < 2ms/frame sin leaks (< 200 líneas).
# ============================================================================

import logging
import threading
import cv2
import numpy as np

logger = logging.getLogger(__name__)

CUDA_AVAILABLE = False
_CUDA_CHECKED = False
_gpu_cache = threading.local()


def _detect_cuda() -> bool:
    """Detecta OpenCV CUDA de forma segura y registra el resultado."""
    global CUDA_AVAILABLE, _CUDA_CHECKED
    if _CUDA_CHECKED:
        return CUDA_AVAILABLE
    _CUDA_CHECKED = True

    try:
        cuda_module = cv2.cuda
    except AttributeError:
        logger.warning(
            "CUDA no disponible (opencv-python estándar sin -DWITH_CUDA=ON). "
            "Usando filtro CPU ultrarrápido (~2ms/frame)."
        )
        return False

    try:
        count = cuda_module.getCudaEnabledDeviceCount()
        if count > 0:
            CUDA_AVAILABLE = True
            try:
                cuda_module.setDevice(0)
                info = cuda_module.DeviceInfo()
                logger.info(
                    f"CUDA habilitado: {info.name()} "
                    f"(CC {info.majorVersion()}.{info.minorVersion()}, "
                    f"{info.totalMemory() / 1024**2:.0f} MB)"
                )
            except Exception:
                logger.info(f"CUDA habilitado: {count} dispositivo(s) detectado(s)")
            return True
        logger.warning("CUDA presente pero sin dispositivos detectables. Usando CPU.")
        return False
    except Exception as e:
        logger.warning(f"Error al detectar dispositivos CUDA: {e}. Usando CPU.")
        return False


_detect_cuda()


def process_frame(frame: np.ndarray) -> np.ndarray:
    """Ejecuta blur Gaussiano 3x3 + unsharp masking (GPU CUDA o fallback CPU)."""
    global CUDA_AVAILABLE
    if CUDA_AVAILABLE:
        try:
            if not hasattr(_gpu_cache, "gpu_frame"):
                _gpu_cache.gpu_frame = cv2.cuda_GpuMat()
                _gpu_cache.gpu_blur = cv2.cuda_GpuMat()
                _gpu_cache.gpu_sharp = cv2.cuda_GpuMat()
                _gpu_cache.gauss_filter = cv2.cuda.createGaussianFilter(
                    cv2.CV_8UC3, cv2.CV_8UC3, (3, 3), 0.8
                )

            _gpu_cache.gpu_frame.upload(frame)
            _gpu_cache.gauss_filter.apply(_gpu_cache.gpu_frame, _gpu_cache.gpu_blur)
            cv2.cuda.addWeighted(
                _gpu_cache.gpu_frame, 1.3, _gpu_cache.gpu_blur, -0.3, 0.0, _gpu_cache.gpu_sharp
            )
            return _gpu_cache.gpu_sharp.download()
        except Exception as e:
            logger.warning(f"GPU falló en este frame: {e}. Cambiando a CPU fallback.")
            CUDA_AVAILABLE = False

    blurred = cv2.GaussianBlur(frame, (3, 3), 0.8)
    return cv2.addWeighted(frame, 1.3, blurred, -0.3, 0)
