"""
Reading progress router — sync and query reading progress.

All endpoints require JWT authentication.

Endpoints:
  POST /api/reading/sync
  GET  /api/reading/{novel_id}
  GET  /api/reading/all
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, User, ReadingProgress
from routers.auth import get_current_user

router = APIRouter(prefix="/api/reading", tags=["Reading Progress"])


class SyncProgressRequest(BaseModel):
    novel_id: str
    chapter_id: str = ""
    chapter_title: str = ""
    progress_percent: float = 0.0


@router.post("/sync")
async def sync_progress(
    req: SyncProgressRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync reading progress for a novel (upsert)."""
    result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.user_id == user.id,
            ReadingProgress.novel_id == req.novel_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.chapter_id = req.chapter_id
        existing.chapter_title = req.chapter_title
        existing.progress_percent = req.progress_percent
        await db.commit()
        return {"message": "Progress updated", "novel_id": req.novel_id}

    progress = ReadingProgress(
        user_id=user.id,
        novel_id=req.novel_id,
        chapter_id=req.chapter_id,
        chapter_title=req.chapter_title,
        progress_percent=req.progress_percent,
    )
    db.add(progress)
    await db.commit()

    return {"message": "Progress saved", "novel_id": req.novel_id}


@router.get("/all")
async def get_all_progress(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get reading progress for all novels."""
    result = await db.execute(
        select(ReadingProgress)
        .where(ReadingProgress.user_id == user.id)
        .order_by(ReadingProgress.updated_at.desc())
    )
    entries = result.scalars().all()

    return {
        "progress": [
            {
                "novel_id": e.novel_id,
                "chapter_id": e.chapter_id,
                "chapter_title": e.chapter_title,
                "progress_percent": e.progress_percent,
                "updated_at": str(e.updated_at),
            }
            for e in entries
        ]
    }


@router.get("/{novel_id}")
async def get_progress(
    novel_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get reading progress for a specific novel."""
    result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.user_id == user.id,
            ReadingProgress.novel_id == novel_id,
        )
    )
    entry = result.scalar_one_or_none()

    if not entry:
        return {
            "novel_id": novel_id,
            "chapter_id": "",
            "chapter_title": "",
            "progress_percent": 0.0,
            "updated_at": None,
        }

    return {
        "novel_id": entry.novel_id,
        "chapter_id": entry.chapter_id,
        "chapter_title": entry.chapter_title,
        "progress_percent": entry.progress_percent,
        "updated_at": str(entry.updated_at),
    }
