import asyncio
import httpx
from bs4 import BeautifulSoup
import json

async def test_search():
    client = httpx.AsyncClient(base_url="https://ixdzs8.com", verify=False)
    resp = await client.get("/bsearch", params={"q": "斗"})
    soup = BeautifulSoup(resp.text, "lxml")
    
    results = []
    # Print the raw HTML of the first <li> to see its structure
    first_li = soup.select_one("li")
    if first_li:
        print("--- First LI HTML ---")
        print(first_li.prettify())
        print("---------------------")

    for item in soup.select("li"):
        # The title is usually in a specific class like .b_name or h3>a
        title_tag = item.select_one("h3 a") or item.select_one("h2 a") or item.select_one(".title a") or item.select_one(".bookname a")
        
        # Original logic: link = item.select_one("a[href*='/read/']")
        link = item.select_one("a[href*='/read/']")
        if not link:
            continue
            
        href = link.get("href", "")
        
        # If title tag found, use that, else try to get text from links
        title = ""
        if title_tag:
            title = title_tag.get_text(strip=True)
            
        if not title:
            # Maybe the title is in the second a tag?
            all_links = item.select("a[href*='/read/']")
            for a in all_links:
                txt = a.get_text(strip=True)
                if txt and len(txt) > 0 and "斗" in txt:
                    title = txt
                    break
        
        if not title:
            # Fallback
            for a in item.select("a"):
                if a.get_text(strip=True):
                    title = a.get_text(strip=True)
                    break

        results.append({
            "href": href,
            "title": title
        })
        
    print("\n--- Extracted Titles ---")
    for r in results:
        print(r)
        
asyncio.run(test_search())
