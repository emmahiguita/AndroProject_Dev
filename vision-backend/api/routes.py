from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
from ingest.webrtc import handle_offer

router = APIRouter()
logger = logging.getLogger(__name__)

class OfferParameters(BaseModel):
    sdp: str
    type: str

@router.post("/offer")
async def offer(params: OfferParameters):
    """
    WebRTC offer endpoint.
    Receives an SDP offer from the frontend, sets up the connection,
    and returns an SDP answer.
    """
    try:
        answer = await handle_offer(params.sdp, params.type)
        return {"sdp": answer.sdp, "type": answer.type}
    except Exception as e:
        logger.error(f"Error handling offer: {e}")
        raise HTTPException(status_code=500, detail=str(e))
