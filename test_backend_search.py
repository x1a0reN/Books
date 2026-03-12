import asyncio
import sys

# Add backend to path to import services
sys.path.append("d:\\Projects\\NovelSite\\workspace")
from services.ixdzs_client import search_novels

async def main():
    print("Testing search_novels...")
    res = await search_novels("斗罗")
    print(f"Keyword: {res['keyword']}")
    for r in res['results']:
        print(f"Title: {r['title']} | Author: {r['author']}")

if __name__ == "__main__":
    asyncio.run(main())
