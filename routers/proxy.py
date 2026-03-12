"""
Proxy router — forwards novel data requests to ixdzs8.com.

Endpoints:
  GET /api/proxy/search?q=...&page=1
  GET /api/proxy/novel/{novel_id}
  GET /api/proxy/novel/{novel_id}/chapters
  GET /api/proxy/novel/{novel_id}/chapter/{chapter_id}
  GET /api/proxy/categories
  GET /api/proxy/category/{category_id}?page=1
  GET /api/proxy/recommendations
  GET /api/proxy/ranking/{ranking_type}?page=1
"""

from fastapi import APIRouter, HTTPException, Query
import logging

from services import ixdzs_client

logger = logging.getLogger(__name__)

_ERR = "数据源暂时不可用，请稍后重试"

router = APIRouter(prefix="/api/proxy", tags=["Proxy"])


@router.get("/search")
async def search(q: str = Query(..., min_length=1), page: int = Query(1, ge=1)):
    """Search novels by keyword."""
    try:
        return await ixdzs_client.search_novels(q, page)
    except Exception as e:
        logger.error("search error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=_ERR)


@router.get("/novel/{novel_id}")
async def novel_detail(novel_id: str):
    """Get novel details (title, author, cover, description, etc.)."""
    try:
        return await ixdzs_client.get_novel_detail(novel_id)
    except Exception as e:
        logger.error("novel_detail error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=_ERR)


@router.get("/novel/{novel_id}/chapters")
async def novel_chapters(novel_id: str):
    """Get the chapter list for a novel."""
    try:
        return await ixdzs_client.get_chapters(novel_id)
    except Exception as e:
        logger.error("chapters error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=_ERR)


@router.get("/novel/{novel_id}/chapter/{chapter_id}")
async def chapter_content(novel_id: str, chapter_id: str):
    """Get the full text content of a chapter."""
    try:
        return await ixdzs_client.get_chapter_content(novel_id, chapter_id)
    except Exception as e:
        logger.error("chapter_content error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=_ERR)


@router.get("/categories")
async def categories():
    """List all available novel categories."""
    try:
        return await ixdzs_client.get_categories()
    except Exception as e:
        logger.error("categories error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=_ERR)


@router.get("/category/{category_id}")
async def category_novels(category_id: str, page: int = Query(1, ge=1)):
    """List novels in a specific category."""
    try:
        return await ixdzs_client.get_category_novels(category_id, page)
    except Exception as e:
        logger.error("category_novels error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=_ERR)


@router.get("/recommendations")
async def recommendations():
    """Get recommended / popular novels from the homepage."""
    try:
        return await ixdzs_client.get_recommendations()
    except Exception as e:
        logger.error("recommendations error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=_ERR)


@router.get("/ranking/{ranking_type}")
async def ranking(ranking_type: str = "hot", page: int = Query(1, ge=1)):
    """Get novel rankings (hot, new, end, etc.)."""
    try:
        return await ixdzs_client.get_ranking(ranking_type, page)
    except Exception as e:
        logger.error("ranking error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=_ERR)
