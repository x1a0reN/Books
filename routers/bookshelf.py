"""
Bookshelf router — manage user's novel bookshelf.

All endpoints require JWT authentication.

Endpoints:
  POST /api/bookshelf/add
  POST /api/bookshelf/remove
  GET  /api/bookshelf/list
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, User, BookshelfEntry
from routers.auth import get_current_user

router = APIRouter(prefix="/api/bookshelf", tags=["Bookshelf"])


class AddBookRequest(BaseModel):
    novel_id: str
    novel_title: str = ""
    novel_author: str = ""
    novel_cover: str = ""


class RemoveBookRequest(BaseModel):
    novel_id: str


@router.post("/add")
async def add_to_bookshelf(
    req: AddBookRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a novel to the user's bookshelf."""
    # Check if already exists
    result = await db.execute(
        select(BookshelfEntry).where(
            BookshelfEntry.user_id == user.id,
            BookshelfEntry.novel_id == req.novel_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        if existing.is_removed:
            # Re-add previously removed book
            existing.is_removed = False
            existing.novel_title = req.novel_title or existing.novel_title
            existing.novel_author = req.novel_author or existing.novel_author
            existing.novel_cover = req.novel_cover or existing.novel_cover
            await db.commit()
            return {"message": "Book re-added to bookshelf", "novel_id": req.novel_id}
        return {"message": "Book already in bookshelf", "novel_id": req.novel_id}

    entry = BookshelfEntry(
        user_id=user.id,
        novel_id=req.novel_id,
        novel_title=req.novel_title,
        novel_author=req.novel_author,
        novel_cover=req.novel_cover,
    )
    db.add(entry)
    await db.commit()

    return {"message": "Book added to bookshelf", "novel_id": req.novel_id}


@router.post("/remove")
async def remove_from_bookshelf(
    req: RemoveBookRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a novel from the user's bookshelf (soft remove)."""
    result = await db.execute(
        select(BookshelfEntry).where(
            BookshelfEntry.user_id == user.id,
            BookshelfEntry.novel_id == req.novel_id,
            BookshelfEntry.is_removed == False,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Book not found in bookshelf")

    entry.is_removed = True
    await db.commit()

    return {"message": "Book removed from bookshelf", "novel_id": req.novel_id}


@router.get("/list")
async def list_bookshelf(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all books in the user's bookshelf."""
    result = await db.execute(
        select(BookshelfEntry)
        .where(
            BookshelfEntry.user_id == user.id,
            BookshelfEntry.is_removed == False,
        )
        .order_by(BookshelfEntry.added_at.desc())
    )
    entries = result.scalars().all()

    return {
        "books": [
            {
                "novel_id": e.novel_id,
                "novel_title": e.novel_title,
                "novel_author": e.novel_author,
                "novel_cover": e.novel_cover,
                "added_at": str(e.added_at),
            }
            for e in entries
        ]
    }
