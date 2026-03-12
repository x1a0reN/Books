"""
TTS router — Edge TTS text-to-speech streaming API.

Endpoints:
  GET /api/tts?text=...&voice=...&rate=...
  GET /api/tts/voices  (list available Chinese voices)
"""

import edge_tts
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/tts", tags=["TTS"])

# Available Chinese voices
VOICES = [
    {"id": "zh-CN-XiaoxiaoNeural", "name": "晓晓", "gender": "女"},
    {"id": "zh-CN-YunxiNeural",    "name": "云希", "gender": "男"},
    {"id": "zh-CN-XiaoyiNeural",   "name": "晓伊", "gender": "女"},
    {"id": "zh-CN-YunyangNeural",  "name": "云扬", "gender": "男"},
]

# Max text length per request (Edge TTS limit is ~5000 chars)
MAX_TEXT_LEN = 5000


@router.get("/voices")
async def list_voices():
    """List available Chinese TTS voices."""
    return {"voices": VOICES}


@router.get("")
async def tts_stream(
    text: str = Query(..., description="Text to synthesize"),
    voice: str = Query("zh-CN-XiaoxiaoNeural", description="Voice ID"),
    rate: str = Query("+0%", description="Speech rate, e.g. +20% or -10%"),
):
    """
    Stream MP3 audio generated from the given text using Edge TTS.
    """
    # Sanitize
    text = text.strip()
    if not text:
        return {"error": "Text is required"}
    if len(text) > MAX_TEXT_LEN:
        text = text[:MAX_TEXT_LEN]

    # Validate voice
    valid_ids = {v["id"] for v in VOICES}
    if voice not in valid_ids:
        voice = "zh-CN-XiaoxiaoNeural"

    async def audio_stream():
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

    return StreamingResponse(
        audio_stream(),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "public, max-age=3600",
        },
    )


from pydantic import BaseModel

class TTSRequest(BaseModel):
    text: str
    voice: str = "zh-CN-XiaoxiaoNeural"
    rate: str = "+0%"


@router.post("/synthesize")
async def tts_synthesize(req: TTSRequest):
    """
    POST version of TTS — accepts text in body to avoid URL length limits
    for large text chunks (whole chapters).
    """
    text = req.text.strip()
    if not text:
        return {"error": "Text is required"}
    if len(text) > MAX_TEXT_LEN:
        text = text[:MAX_TEXT_LEN]

    valid_ids = {v["id"] for v in VOICES}
    voice = req.voice if req.voice in valid_ids else "zh-CN-XiaoxiaoNeural"

    async def audio_stream():
        communicate = edge_tts.Communicate(text, voice, rate=req.rate)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

    return StreamingResponse(
        audio_stream(),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "public, max-age=3600",
        },
    )
