"""Application configuration using pydantic-settings."""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────
    app_name: str = "NovelSiteBackend"
    debug: bool = False

    # ── ixdzs8 source ───────────────────────────────────
    ixdzs_base_url: str = "https://ixdzs8.com"

    # ── Database ────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./data/novel_site.db"

    # ── JWT ──────────────────────────────────────────────
    jwt_secret: str = "CHANGE_ME_IN_PRODUCTION_a7f3e2d1b9c8"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 60 * 24       # 24 h
    jwt_refresh_expire_minutes: int = 60 * 24 * 30  # 30 days

    # ── File cache ──────────────────────────────────────
    cache_dir: str = "./cache"

    model_config = {"env_prefix": "NOVEL_", "env_file": ".env"}


settings = Settings()

# Ensure cache directory exists
Path(settings.cache_dir).mkdir(parents=True, exist_ok=True)
Path("./data").mkdir(parents=True, exist_ok=True)
