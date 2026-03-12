"""
Async HTTP client for proxying requests to ixdzs8.com.

Provides methods for searching novels, fetching novel/chapter details,
browsing categories, and getting recommendation/popular listings.
"""

import re
import time
import asyncio
import logging
from typing import Optional
from urllib.parse import quote, urljoin

import httpx
from bs4 import BeautifulSoup

from config import settings

logger = logging.getLogger(__name__)

# ── Simple TTL Cache ──────────────────────────────────
_cache: dict = {}  # key -> (timestamp, data)
_CACHE_TTL = 600   # 10 minutes


def _cache_get(key: str):
    """Return cached data if still valid, else None."""
    entry = _cache.get(key)
    if entry and (time.time() - entry[0]) < _CACHE_TTL:
        return entry[1]
    return None


def _cache_set(key: str, data):
    _cache[key] = (time.time(), data)

# Reusable headers to mimic a browser
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

# Long-lived async client (created once per process)
_client: Optional[httpx.AsyncClient] = None


async def get_client() -> httpx.AsyncClient:
    """Return (and lazily create) the shared httpx client."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=settings.ixdzs_base_url,
            headers=_HEADERS,
            timeout=30.0,
            follow_redirects=True,
            verify=False,
        )
    return _client


async def close_client():
    """Shutdown the shared client (called on app shutdown)."""
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


async def _fetch_with_challenge(url: str) -> httpx.Response:
    """
    Fetch a page, handling ixdzs8's JS security challenge.
    The site sometimes returns a small HTML page with a JS token;
    we extract the token and re-request with ?challenge=<token>.
    """
    client = await get_client()
    resp = await client.get(url)
    resp.raise_for_status()

    # Detect the challenge page (very short HTML with a token)
    if len(resp.text) < 1500 and '正在進行安全驗證' in resp.text:
        m = re.search(r'let token = "([^"]+)"', resp.text)
        if m:
            token = m.group(1)
            separator = '&' if '?' in url else '?'
            challenge_url = f"{url}{separator}challenge={token}"
            resp2 = await client.get(challenge_url)
            resp2.raise_for_status()
            return resp2

    return resp


async def _fetch_cover_url(novel_id: str) -> str:
    """Fetch the OG cover image URL from a novel's detail page."""
    try:
        resp = await _fetch_with_challenge(f"/read/{novel_id}/")
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "lxml")
            og_img = soup.select_one('meta[property="og:image"]')
            if og_img:
                return og_img.get("content", "")
    except Exception:
        pass
    return ""


# ═══════════════════════════════════════════════════════
#  Search
# ═══════════════════════════════════════════════════════
async def search_novels(keyword: str, page: int = 1) -> dict:
    """
    Search novels on ixdzs8.com.
    Returns { results: [...], keyword, page }
    """
    client = await get_client()
    resp = await client.get("/bsearch", params={"q": keyword})
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")
    results = []

    # Search results are in <li> items with links to /read/{id}/
    for item in soup.select("li"):
        link = item.select_one("a[href*='/read/']")
        if not link:
            continue
        href = link.get("href", "")
        novel_id = _extract_id(href)
        if not novel_id:
            continue

        # The title is usually in a specific class like h2>a, h3>a, or .title>a
        title = ""
        title_tag = item.select_one("h3 a") or item.select_one("h2 a") or item.select_one(".title a") or item.select_one(".bookname a")
        if title_tag:
            title = title_tag.get_text(strip=True)
            
        if not title:
            # Fallback: find the first text-containing link
            for a in item.select("a[href*='/read/']"):
                txt = a.get_text(strip=True)
                if txt:
                    title = txt
                    break

        if not title:
            title = "未知书名"

        # Author is usually in a separate <a> with /author/ link
        author = "未知作者"
        author_el = item.select_one("a[href*='/author/']")
        if author_el:
            author = author_el.get_text(strip=True)
        else:
            # Fallback for author: look for text containing "作者："
            text_parts = item.get_text("|", strip=True).split("|")
            for part in text_parts:
                if "作者" in part:
                    author = part.replace("作者：", "").replace("作者:", "").strip()
                    break

        # Description text
        desc = ""
        text_parts = item.get_text("|", strip=True).split("|")
        for part in text_parts:
            if len(part) > 30 and part != title:
                desc = part[:200]
                break
        # Clean residual HTML tags from description (#1)
        if desc:
            desc = re.sub(r'<[^>]+>', '', desc).strip()

        # Cover URL — already in the HTML <img> tag
        cover_url = ""
        img_el = item.select_one("img")
        if img_el:
            cover_url = img_el.get("src", "") or img_el.get("data-src", "")

        results.append({
            "novel_id": novel_id,
            "title": title,
            "author": author,
            "description": desc,
            "cover_url": cover_url,
            "url": href,
        })

    return {"results": results, "keyword": keyword, "page": page}


# ═══════════════════════════════════════════════════════
#  Novel Detail
# ═══════════════════════════════════════════════════════
async def get_novel_detail(novel_id: str) -> dict:
    """
    Fetch novel details (title, author, cover, description, status).
    """
    url = f"/read/{novel_id}/"
    resp = await _fetch_with_challenge(url)

    soup = BeautifulSoup(resp.text, "lxml")

    # Title from <h1>
    title = _text(soup, "h1") or novel_id

    # Author: extract from <title> tag "斗破苍穹_作者:天蚕土豆_爱下电子书"
    author = ""
    page_title = soup.title.text if soup.title else ""
    if "_作者:" in page_title:
        author = page_title.split("_作者:")[1].split("_")[0]
    if not author:
        author_el = soup.select_one("a[href*='/author/']")
        if author_el:
            author = author_el.get_text(strip=True)

    # Cover from OG image meta tag
    cover = ""
    og_img = soup.select_one("meta[property='og:image']")
    if og_img:
        cover = og_img.get("content", "")
    if not cover:
        # Fallback: first img with a meaningful src
        for img in soup.select("img"):
            src = img.get("src", "")
            if src and ("/cover/" in src or ".jpg" in src or ".png" in src):
                cover = src if src.startswith("http") else urljoin(settings.ixdzs_base_url, src)
                break

    # Description from OG description meta tag
    desc = ""
    og_desc = soup.select_one("meta[property='og:description']")
    if og_desc:
        desc = og_desc.get("content", "").strip()
    if not desc:
        desc = _text(soup, ".intro, .desc, .synopsis")

    # Status and category from breadcrumbs or page content
    status = ""
    category = ""
    for a in soup.select("a[href*='/sort/']"):
        cat_text = a.get_text(strip=True)
        if cat_text and len(cat_text) < 10:
            category = cat_text
            break

    # TXT/ZIP download link
    txt_url = ""
    for a in soup.select("a"):
        href = a.get("href", "")
        text = a.get_text(strip=True)
        if ".zip" in href or ".txt" in href or "down" in href:
            txt_url = href if href.startswith("http") else urljoin(settings.ixdzs_base_url, href)
            break
        if "下载" in text or "txt" in text.lower():
            txt_url = href if href.startswith("http") else urljoin(settings.ixdzs_base_url, href)
            break

    return {
        "novel_id": novel_id,
        "title": title,
        "author": author,
        "cover": cover,
        "description": desc,
        "status": status,
        "category": category,
        "txt_download_url": txt_url,
    }


# ═══════════════════════════════════════════════════════
#  Chapter List
# ═══════════════════════════════════════════════════════
async def get_chapters(novel_id: str) -> dict:
    """
    Fetch the chapter list for a novel.
    Uses the /novel/clist/ AJAX endpoint which returns ALL chapters,
    unlike the detail page HTML which only shows the latest ~10.
    Returns { novel_id, chapters: [ {chapter_id, title, url}, ... ] }
    """
    client = await get_client()
    chapters = []

    # Primary: use the AJAX API that powers the JS chapter list
    try:
        resp = await client.post(
            "/novel/clist/",
            data={"bid": novel_id},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if resp.status_code == 200:
            result = resp.json()
            if result.get("rs") == 200 and result.get("data"):
                for ch in result["data"]:
                    ordernum = ch.get("ordernum", "")
                    title = ch.get("title", "")
                    if ordernum and title:
                        cid = f"p{ordernum}"
                        chapters.append({
                            "chapter_id": cid,
                            "title": title,
                            "url": f"/read/{novel_id}/{cid}.html",
                        })
    except Exception as e:
        logger.warning(f"Failed to fetch chapter list via API for {novel_id}: {e}")

    # Fallback: scrape the detail page HTML if the API didn't work
    if not chapters:
        url = f"/read/{novel_id}/"
        resp = await _fetch_with_challenge(url)
        soup = BeautifulSoup(resp.text, "lxml")
        for a in soup.select(f"a[href*='/read/{novel_id}/p']"):
            title = a.get_text(strip=True)
            href = a.get("href", "")
            cid = _extract_chapter_id(href, novel_id)
            if title and cid:
                chapters.append({
                    "chapter_id": cid,
                    "title": title,
                    "url": href,
                })

    return {"novel_id": novel_id, "chapters": chapters}


# ═══════════════════════════════════════════════════════
#  Chapter Content
# ═══════════════════════════════════════════════════════
async def get_chapter_content(novel_id: str, chapter_id: str) -> dict:
    """
    Fetch the content of a single chapter.
    """
    url = f"/read/{novel_id}/{chapter_id}.html"
    resp = await _fetch_with_challenge(url)

    soup = BeautifulSoup(resp.text, "lxml")

    title = _text(soup, "h1, .title, .chapter-title") or chapter_id

    # Try multiple selectors for content container
    content = ""
    for selector in ["#content", ".content", ".chapter-content", ".articlecontent", "article", ".ncontainer"]:
        content_el = soup.select_one(selector)
        if content_el and len(content_el.get_text(strip=True)) > 50:
            # Convert to HTML paragraphs for the frontend
            for br in content_el.find_all("br"):
                br.replace_with("\n")
            raw_text = content_el.get_text("\n", strip=False).strip()
            # Convert plain text lines to <p> tags
            lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
            content = "".join(f"<p>{line}</p>" for line in lines)
            break

    # Extract prev/next chapter links
    prev_chapter = ""
    next_chapter = ""
    for a in soup.select("a"):
        text = a.get_text(strip=True)
        href = a.get("href", "")
        if ("上一章" in text or "上一页" in text) and f"/read/{novel_id}/" in href:
            cid = _extract_chapter_id(href, novel_id)
            if cid:
                prev_chapter = cid
        elif ("下一章" in text or "下一页" in text) and f"/read/{novel_id}/" in href:
            cid = _extract_chapter_id(href, novel_id)
            if cid:
                next_chapter = cid

    return {
        "novel_id": novel_id,
        "chapter_id": chapter_id,
        "title": title,
        "content": content,
        "prev_chapter": prev_chapter,
        "next_chapter": next_chapter,
    }


# ═══════════════════════════════════════════════════════
#  Categories
# ═══════════════════════════════════════════════════════
async def get_categories() -> dict:
    """
    Return available novel categories.
    Based on the ixdzs8.com sort system.
    """
    # Known categories from ixdzs8.com — these are stable
    categories = [
        {"category_id": "1", "name": "玄幻", "url": "/sort/1/"},
        {"category_id": "2", "name": "奇幻", "url": "/sort/2/"},
        {"category_id": "3", "name": "都市", "url": "/sort/3/"},
        {"category_id": "4", "name": "历史", "url": "/sort/4/"},
        {"category_id": "5", "name": "科幻", "url": "/sort/5/"},
        {"category_id": "6", "name": "游戏", "url": "/sort/6/"},
        {"category_id": "7", "name": "言情", "url": "/sort/7/"},
        {"category_id": "8", "name": "武侠", "url": "/sort/8/"},
        {"category_id": "9", "name": "古言", "url": "/sort/9/"},
        {"category_id": "10", "name": "悬疑", "url": "/sort/10/"},
        {"category_id": "11", "name": "同人", "url": "/sort/11/"},
        {"category_id": "12", "name": "轻小说", "url": "/sort/12/"},
    ]
    return {"categories": categories}


async def get_category_novels(category_id: str, page: int = 1) -> dict:
    """
    Fetch novels in a specific category.
    Supports ?t=1 for completed novels only.
    """
    client = await get_client()
    url = f"/sort/{category_id}/"
    params = {"page": page}
    resp = await client.get(url, params=params)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")
    novels = _parse_novel_list(soup)

    return {"category_id": category_id, "page": page, "novels": novels}


# ═══════════════════════════════════════════════════════
#  Recommendations / Popular
# ═══════════════════════════════════════════════════════
async def get_recommendations() -> dict:
    """
    Fetch recommended / popular novels from the homepage.
    """
    cached = _cache_get("recommendations")
    if cached:
        return cached

    resp = await _fetch_with_challenge("/")
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")
    sections = {}

    for section in soup.select("div.section, div.block, div.module, section"):
        heading = section.select_one("h2, h3, .title, .hd")
        if not heading:
            continue
        section_name = heading.get_text(strip=True)
        novels = _parse_novel_list(section)
        if novels:
            sections[section_name] = novels

    if not sections:
        novels = _parse_novel_list(soup)
        if novels:
            sections["推荐"] = novels

    # Enrich covers: fetch og:image for novels missing cover_url
    novels_needing_covers = []
    for sec_novels in sections.values():
        for n in sec_novels:
            if not n.get("cover_url"):
                novels_needing_covers.append(n)

    if novels_needing_covers:
        tasks = [_fetch_cover_url(n["novel_id"]) for n in novels_needing_covers]
        cover_urls = await asyncio.gather(*tasks)
        for n, url in zip(novels_needing_covers, cover_urls):
            if url:
                n["cover_url"] = url
        logger.info(f"[COVER] Fetched {sum(1 for u in cover_urls if u)}/{len(novels_needing_covers)} covers")

    result = {"sections": sections}
    _cache_set("recommendations", result)
    return result


async def get_ranking(ranking_type: str = "hot", page: int = 1) -> dict:
    """
    Fetch ranking/leaderboard novels.
    ranking_type: hot, new, end
    """
    cache_key = f"ranking_{ranking_type}_{page}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    url = f"/{ranking_type}/"
    resp = await _fetch_with_challenge(url)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")
    novels = _parse_novel_list(soup)

    # Enrich covers for novels missing them
    novels_needing_covers = [n for n in novels if not n.get("cover_url")]
    if novels_needing_covers:
        tasks = [_fetch_cover_url(n["novel_id"]) for n in novels_needing_covers]
        cover_urls = await asyncio.gather(*tasks)
        for n, url in zip(novels_needing_covers, cover_urls):
            if url:
                n["cover_url"] = url

    result = {"ranking_type": ranking_type, "page": page, "novels": novels}
    _cache_set(cache_key, result)
    return result


# ═══════════════════════════════════════════════════════
#  TXT Download URL
# ═══════════════════════════════════════════════════════
async def get_txt_download_url(novel_id: str) -> Optional[str]:
    """
    Get the TXT download URL for a novel.
    Returns the direct URL or None.
    """
    detail = await get_novel_detail(novel_id)
    url = detail.get("txt_download_url")
    if url:
        return url

    # Fallback: try common patterns
    client = await get_client()
    for pattern in [f"/down/{novel_id}.html", f"/read/{novel_id}/download"]:
        try:
            resp = await client.get(pattern)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "lxml")
                for a in soup.select("a"):
                    href = a.get("href", "")
                    if ".txt" in href or "download" in href.lower():
                        return href if href.startswith("http") else urljoin(settings.ixdzs_base_url, href)
        except Exception:
            continue

    return None


# ═══════════════════════════════════════════════════════
#  Internal Helpers
# ═══════════════════════════════════════════════════════
def _text(soup: BeautifulSoup, selector: str) -> str:
    """Get text from the first matching element."""
    el = soup.select_one(selector)
    return el.get_text(strip=True) if el else ""


def _extract_id(href: str) -> Optional[str]:
    """Extract a numeric or slug ID from a URL path like /read/12345/ or /sort/1/."""
    if not href:
        return None
    m = re.search(r"/read/(\d+)", href)
    if m:
        return m.group(1)
    m = re.search(r"/sort/([^/]+)", href)
    if m:
        return m.group(1)
    return None


def _extract_chapter_id(href: str, novel_id: str) -> Optional[str]:
    """Extract chapter ID from href like /read/38804/p123.html."""
    if not href:
        return None
    m = re.search(rf"/read/{re.escape(novel_id)}/(p\d+)\.html", href)
    if m:
        return m.group(1)
    # Fallback: last path segment without extension
    parts = href.strip("/").split("/")
    if parts:
        last = parts[-1].replace(".html", "").replace(".htm", "")
        if last and last != novel_id:
            return last
    return None


def _parse_novel_list(container) -> list:
    """
    Parse a list of novels from a BeautifulSoup container.
    Returns [{ novel_id, title, author, cover_url, url }, ...]
    """
    novels = []
    seen_ids = set()

    # Strategy 1: Iterate each <li> — works for homepage sections
    for li in container.select("li"):
        book_link = li.select_one("a[href*='/read/']")
        if not book_link:
            continue

        href = book_link.get("href", "")
        nid = _extract_id(href)
        if not nid or nid in seen_ids:
            continue

        title = book_link.get_text(strip=True)
        if not title or len(title) > 100:
            continue

        seen_ids.add(nid)

        author = ""
        author_el = li.select_one("a[href*='/author/']")
        if author_el:
            author = author_el.get_text(strip=True)

        # Extract cover URL from <img> tag within the <li>
        cover_url = ""
        img_el = li.select_one("img")
        if img_el:
            cover_url = img_el.get("src", "") or img_el.get("data-src", "")
        # Leave empty — will be enriched at the end via og:image
        if not cover_url:
            cover_url = ""

        # Extract description text (#7)
        description = ""
        all_text = li.get_text("|", strip=True).split("|")
        for part in all_text:
            clean = re.sub(r'<[^>]+>', '', part).strip()
            if len(clean) > 20 and clean != title and clean != author:
                description = clean[:200]
                break

        novels.append({
            "novel_id": nid,
            "title": title,
            "author": author,
            "cover_url": cover_url,
            "description": description,
            "url": href,
        })

    # Strategy 2: If no <li> results, scan all /read/ links directly
    # (for hot/sort pages that use <h3> blocks instead of <li>)
    if not novels:
        for a in container.select("a[href*='/read/']"):
            href = a.get("href", "")
            nid = _extract_id(href)
            if not nid or nid in seen_ids:
                continue

            title = a.get_text(strip=True)
            if not title or len(title) > 100:
                continue

            seen_ids.add(nid)

            # Look for author link nearby (in parent or sibling)
            author = ""
            parent = a.parent
            while parent and parent.name not in ("body", "html", None):
                author_el = parent.select_one("a[href*='/author/']")
                if author_el:
                    author = author_el.get_text(strip=True)
                    break
                parent = parent.parent

            # Extract cover from nearby img
            cover_url = ""
            if parent:
                img_el = parent.select_one("img")
                if img_el:
                    cover_url = img_el.get("src", "") or img_el.get("data-src", "")

            # Leave empty — will be enriched at the end via og:image
            if not cover_url:
                cover_url = ""

            novels.append({
                "novel_id": nid,
                "title": title,
                "author": author,
                "cover_url": cover_url,
                "description": "",
                "url": href,
            })

    # ── Post-processing: enrich covers ────────────────
    # On some pages, img tags are inside separate <a> links (not the same <li>).
    # Build a map of novel_id -> cover_url from ALL <a>+<img> combos.
    cover_map = {}
    for a_tag in container.select("a[href*='/read/']"):
        img = a_tag.select_one("img")
        if img:
            nid = _extract_id(a_tag.get("href", ""))
            if nid:
                src = img.get("src", "") or img.get("data-src", "")
                if src:
                    cover_map[nid] = src

    if cover_map:
        for n in novels:
            if not n.get("cover_url") and n["novel_id"] in cover_map:
                n["cover_url"] = cover_map[n["novel_id"]]

    return novels

