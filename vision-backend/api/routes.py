# ============================================================================
# ARCHIVO: routes.py
# QUÉ HACE: Expone el endpoint HTTP `POST /vision/offer` para señalización SDP.
# CÓMO FUNCIONA: Valida que la oferta entrante tenga `type == "offer"` y SDP
#           no vacío antes de delegar a `ingest.webrtc.handle_offer`.
# POR QUÉ: Rechazar payloads inválidos con 400 en lugar de 500 (SRP).
# ============================================================================

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ingest.webrtc import handle_offer

router = APIRouter()
logger = logging.getLogger(__name__)


class OfferParameters(BaseModel):
    sdp: str
    type: str


@router.post("/offer")
async def offer(params: OfferParameters):
    """Recibe una oferta SDP WebRTC del frontend y devuelve la respuesta SDP."""
    if params.type != "offer" or not params.sdp.strip():
        raise HTTPException(status_code=400, detail="SDP offer inválido: se requiere type='offer' y sdp no vacío.")
    try:
        answer = await handle_offer(params.sdp, params.type)
        return {"sdp": answer.sdp, "type": answer.type}
    except Exception as e:
        logger.error(f"Error handling offer: {e}")
        raise HTTPException(status_code=500, detail=str(e))
