"""
NovelSiteBackend — FastAPI application entry point.

A lightweight backend that:
  1. Proxies novel data from ixdzs8.com (search, detail, chapters, content)
  2. Provides category browsing and recommendation feeds
  3. Handles TXT file downloads with server-side caching
  4. Manages user accounts, bookshelves, and reading progress
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import settings
from database import init_db
from services import ixdzs_client

# ── Logging ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("novel-site")


# ── Lifespan ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    logger.info("🚀 Starting NovelSiteBackend…")
    await init_db()
    logger.info("✅ Database initialized")
    yield
    await ixdzs_client.close_client()
    logger.info("👋 Shutdown complete")


# ── App ─────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Novel reading backend — proxies ixdzs8.com data, "
        "manages user bookshelves and reading progress, "
        "and provides TXT downloads with server-side caching."
    ),
    lifespan=lifespan,
)

# CORS — restrict to production domains (#13)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://book.x1a0ren.com", "https://book.x1a0ren.com", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Register Routers ───────────────────────────────────
from routers.proxy import router as proxy_router
from routers.download import router as download_router
from routers.auth import router as auth_router
from routers.bookshelf import router as bookshelf_router
from routers.reading import router as reading_router
from routers.tts import router as tts_router

app.include_router(proxy_router)
app.include_router(download_router)
app.include_router(auth_router)
app.include_router(bookshelf_router)
app.include_router(reading_router)
app.include_router(tts_router)


# ── Health Check ────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
async def health():
    return {"status": "healthy"}

# ── Frontend Serving ────────────────────────────────────
_base_dir = os.path.dirname(os.path.abspath(__file__))
frontend_path = os.path.join(_base_dir, "dist")
if os.path.exists(frontend_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            return {"error": "API route not found"}
        # Serve actual static files (e.g. favicon.png) if they exist in dist/
        file_path = os.path.join(frontend_path, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise serve index.html for SPA routing
        return FileResponse(os.path.join(frontend_path, "index.html"))
else:
    @app.get("/")
    async def root():
        return {
            "service": settings.app_name,
            "message": f"Frontend not found at {frontend_path}"
        }


# ── Run directly ────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
