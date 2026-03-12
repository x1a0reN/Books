"""
Download router — TXT file download with server-side caching.

Endpoints:
  GET /api/download/{novel_id}
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from services import txt_downloader

router = APIRouter(prefix="/api/download", tags=["Download"])


@router.get("/{novel_id}")
async def download_txt(novel_id: str):
    """
    Download the TXT file for a novel.
    The file is cached on the server after the first download.
    """
    local_path = await txt_downloader.ensure_cached(novel_id)
    if local_path is None:
        raise HTTPException(
            status_code=404,
            detail=f"TXT file not available for novel {novel_id}",
        )

    return FileResponse(
        path=str(local_path),
        filename=f"{novel_id}.txt",
        media_type="text/plain; charset=utf-8",
    )
