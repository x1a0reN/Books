"""
TXT file downloader with server-side caching.

Downloads the ZIP archive from ixdzs8.com, extracts the TXT file,
converts encoding to UTF-8 if needed, caches it locally, and serves it.
"""

import io
import logging
import zipfile
from pathlib import Path

import httpx

from config import settings
from services import ixdzs_client

logger = logging.getLogger(__name__)

CACHE_DIR = Path(settings.cache_dir)


def _detect_and_decode(raw: bytes) -> str:
    """
    Try multiple encodings to decode Chinese novel text.
    ixdzs8 typically uses GBK/GB18030 encoding.
    """
    for encoding in ["utf-8", "gb18030", "gbk", "gb2312", "big5"]:
        try:
            return raw.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue
    # Last resort: decode with errors replaced
    return raw.decode("gb18030", errors="replace")


def _extract_txt_from_zip(zip_bytes: bytes) -> str | None:
    """
    Extract the first .txt file from a ZIP archive and return its
    content decoded as UTF-8 string.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            # Find the .txt file inside the ZIP
            txt_names = [n for n in zf.namelist() if n.lower().endswith(".txt")]
            if not txt_names:
                # No .txt found — try any file that's not a directory
                txt_names = [n for n in zf.namelist() if not n.endswith("/")]

            if not txt_names:
                logger.error("ZIP archive contains no files")
                return None

            # Use the largest file (likely the novel content)
            target = max(txt_names, key=lambda n: zf.getinfo(n).file_size)
            raw = zf.read(target)
            logger.info("Extracted '%s' from ZIP (%d bytes)", target, len(raw))
            return _detect_and_decode(raw)

    except zipfile.BadZipFile:
        logger.warning("Downloaded file is not a valid ZIP, trying as raw text")
        return _detect_and_decode(zip_bytes)
    except Exception as exc:
        logger.error("Failed to extract TXT from ZIP: %s", exc)
        return None


async def ensure_cached(novel_id: str) -> Path | None:
    """
    Ensure the TXT file for *novel_id* is cached locally as UTF-8.
    Returns the local file path, or None if download fails.
    """
    local_path = CACHE_DIR / f"{novel_id}.txt"

    # Already cached
    if local_path.exists() and local_path.stat().st_size > 0:
        logger.info("Cache hit for novel %s", novel_id)
        return local_path

    # Get the download URL from the source site
    download_url = await ixdzs_client.get_txt_download_url(novel_id)
    if not download_url:
        logger.warning("No TXT download URL found for novel %s", novel_id)
        return None

    # Download the file (usually a .zip archive)
    logger.info("Downloading for novel %s from %s", novel_id, download_url)
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=120.0,
            headers=ixdzs_client._HEADERS,
            verify=False,
        ) as client:
            resp = await client.get(download_url)
            resp.raise_for_status()

            # Extract TXT from ZIP and convert encoding to UTF-8
            content = _extract_txt_from_zip(resp.content)
            if not content:
                logger.error("Could not extract text for novel %s", novel_id)
                return None

            # Write UTF-8 text to cache
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            local_path.write_text(content, encoding="utf-8")

            size_mb = len(content.encode("utf-8")) / (1024 * 1024)
            logger.info("Cached %.2f MB (UTF-8) for novel %s", size_mb, novel_id)
            return local_path

    except Exception as exc:
        logger.error("Failed to download TXT for novel %s: %s", novel_id, exc)
        return None


def get_cached_path(novel_id: str) -> Path | None:
    """Return the cached file path if it exists, else None."""
    p = CACHE_DIR / f"{novel_id}.txt"
    return p if p.exists() and p.stat().st_size > 0 else None
