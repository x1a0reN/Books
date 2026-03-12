"""SQLAlchemy async database setup and ORM models."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, DateTime, Boolean,
    ForeignKey, Text, UniqueConstraint
)
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, relationship

from config import settings


# ── Engine & Session ────────────────────────────────────
engine = create_async_engine(settings.database_url, echo=settings.debug)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── User ────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(128), nullable=True, default="")
    hashed_password = Column(String(256), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)

    bookshelf = relationship("BookshelfEntry", back_populates="user", lazy="selectin")
    progress = relationship("ReadingProgress", back_populates="user", lazy="selectin")


# ── Bookshelf ───────────────────────────────────────────
class BookshelfEntry(Base):
    __tablename__ = "bookshelf"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    novel_id = Column(String(64), nullable=False)
    novel_title = Column(String(256), default="")
    novel_author = Column(String(128), default="")
    novel_cover = Column(Text, default="")
    added_at = Column(DateTime, default=_utcnow)
    is_removed = Column(Boolean, default=False)

    user = relationship("User", back_populates="bookshelf")

    __table_args__ = (
        UniqueConstraint("user_id", "novel_id", name="uq_user_novel"),
    )


# ── Reading Progress ───────────────────────────────────
class ReadingProgress(Base):
    __tablename__ = "reading_progress"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    novel_id = Column(String(64), nullable=False)
    chapter_id = Column(String(128), default="")
    chapter_title = Column(String(256), default="")
    progress_percent = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    user = relationship("User", back_populates="progress")

    __table_args__ = (
        UniqueConstraint("user_id", "novel_id", name="uq_user_novel_progress"),
    )


# ── Helpers ─────────────────────────────────────────────
async def init_db():
    """Create all tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """FastAPI dependency – yields a DB session."""
    async with async_session() as session:
        yield session
