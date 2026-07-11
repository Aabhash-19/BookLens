"""
Book lookup service.

Priority order for metadata:
  1. Local BookLens DB (avoid repeat API calls)
  2. Open Library
  3. Google Books

Results are cached in Redis for 24 hours.
"""
import json
import asyncio
from typing import Optional
import httpx
import redis.asyncio as aioredis

from app.core.config import get_settings

REDIS_CACHE_TTL = 86400  # 24 hours

_redis_client: Optional[aioredis.Redis] = None


async def _get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


# ── Normalisation ─────────────────────────────────────────────────────────────

def _normalise_open_library(data: dict) -> dict:
    """Map an Open Library works/editions response to our canonical BookData."""
    authors = []
    if "author_name" in data:
        authors = data["author_name"]
    elif "authors" in data:
        authors = [a.get("name", "") for a in data.get("authors", [])]

    isbn_list = data.get("isbn", [])
    isbn_13 = next((i for i in isbn_list if len(i) == 13), None)
    isbn_10 = next((i for i in isbn_list if len(i) == 10), None)

    cover_id = data.get("cover_i") or (data.get("covers", [None])[0])
    cover_url = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg" if cover_id else None

    subjects = data.get("subject", data.get("subjects", []))
    if isinstance(subjects, list):
        genres = [s for s in subjects[:10] if isinstance(s, str)]
    else:
        genres = []

    ol_key = data.get("key", "")
    ol_id = ol_key.split("/")[-1] if ol_key else None

    return {
        "title": data.get("title", "Unknown Title"),
        "subtitle": data.get("subtitle"),
        "authors": authors,
        "description": _extract_description(data.get("description")),
        "isbn_10": isbn_10,
        "isbn_13": isbn_13,
        "publisher": (data.get("publisher", [None]) or [None])[0],
        "publication_date": _extract_year(data),
        "page_count": data.get("number_of_pages"),
        "cover_url": cover_url,
        "language": (data.get("language", [None]) or [None])[0],
        "genres": genres,
        "open_library_id": ol_id,
        "google_books_id": None,
        "metadata_source": "open_library",
        "average_rating": None,
        "ratings_count": None,
    }


def _normalise_google_books(item: dict) -> dict:
    """Map a Google Books volumes item to our canonical BookData."""
    info = item.get("volumeInfo", {})
    identifiers = {i["type"]: i["identifier"] for i in info.get("industryIdentifiers", [])}

    cover_url = None
    images = info.get("imageLinks", {})
    cover_url = images.get("large") or images.get("thumbnail")

    return {
        "title": info.get("title", "Unknown Title"),
        "subtitle": info.get("subtitle"),
        "authors": info.get("authors", []),
        "description": info.get("description"),
        "isbn_10": identifiers.get("ISBN_10"),
        "isbn_13": identifiers.get("ISBN_13"),
        "publisher": info.get("publisher"),
        "publication_date": info.get("publishedDate", "")[:4] or None,
        "page_count": info.get("pageCount"),
        "cover_url": cover_url,
        "language": info.get("language"),
        "genres": info.get("categories", []),
        "open_library_id": None,
        "google_books_id": item.get("id"),
        "metadata_source": "google_books",
        "average_rating": info.get("averageRating"),
        "ratings_count": info.get("ratingsCount"),
    }


def _extract_description(desc) -> Optional[str]:
    text = None
    if isinstance(desc, dict):
        text = desc.get("value")
    elif isinstance(desc, str):
        text = desc
    
    if text:
        text = text.strip()
        if len(text) < 150 or text.lower().startswith("source title"):
            return None
        return text
    return None

def rank_wikipedia_pages(pages: list, title: str, author: str) -> Optional[dict]:
    best_page = None
    best_score = -1
    
    t_clean = title.lower().strip()
    a_clean = author.lower().strip()
    
    for page in pages:
        p_title = page.get("title", "").lower().strip()
        extract = page.get("extract", "")
        
        # 1. Reject if page title is exactly the author name or a substring of it
        if p_title == a_clean or p_title in a_clean or a_clean in p_title:
            continue
            
        # 2. Reject if the extract suggests it's a bio of the author
        if a_clean in p_title or extract.startswith(f"{author} is") or extract.startswith(f"{author} (born"):
            continue
            
        # 3. Calculate match score
        score = 0
        if p_title == t_clean:
            score = 100
        elif p_title == f"{t_clean} (novel)":
            score = 95
        elif p_title == f"{t_clean} (book)":
            score = 90
        elif p_title == f"{t_clean} (series)":
            score = 80
        elif p_title == f"{t_clean} (film)":
            score = 60
        elif p_title == f"{t_clean} (play)":
            score = 50
        elif t_clean in p_title:
            score = 40
        elif p_title in t_clean:
            score = 30
            
        if score == 0:
            continue
            
        if score > best_score:
            best_score = score
            best_page = page
            
    return best_page


async def _wikipedia_summary(title: str, author: str, client: httpx.AsyncClient) -> Optional[str]:
    """Fetch a massive summary from Wikipedia based on book title and author."""
    try:
        # Append "book" to help Wikipedia rank the novel higher than movies or songs
        query = f"{title} {author} book".strip()
        url = "https://en.wikipedia.org/w/api.php"
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": query,
            "gsrlimit": "5",
            "prop": "extracts",
            "exintro": "1",
            "explaintext": "1",
            "format": "json"
        }
        headers = {
            "User-Agent": "BookLens/1.0 (contact@booklens.com)"
        }
        r = await client.get(url, params=params, headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            pages = data.get("query", {}).get("pages", {})
            if pages:
                # Sort pages by index (search ranking)
                sorted_pages = sorted(pages.values(), key=lambda p: p.get("index", 999))
                best_page = rank_wikipedia_pages(sorted_pages, title, author)
                if best_page:
                    extract = best_page.get("extract")
                    if extract and len(extract) > 100:
                        return extract
    except Exception:
        pass
    return None

async def get_wikipedia_summary(title: str, author: str) -> Optional[str]:
    async with httpx.AsyncClient() as client:
        return await _wikipedia_summary(title, author, client)



def _extract_year(data: dict) -> Optional[str]:
    for key in ("first_publish_year", "publish_year"):
        val = data.get(key)
        if val:
            return str(val[0] if isinstance(val, list) else val)
    return None


# ── Open Library ──────────────────────────────────────────────────────────────

async def _ol_isbn_lookup(isbn: str, client: httpx.AsyncClient) -> Optional[dict]:
    """Look up a book by ISBN from Open Library."""
    try:
        url = f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=details"
        r = await client.get(url, timeout=10)
        r.raise_for_status()
        body = r.json()
        key = f"ISBN:{isbn}"
        if key in body:
            raw = body[key]
            details = raw.get("details", {})
            
            # Normalise manually since this endpoint returns a different schema
            authors = [a.get("name", "") for a in raw.get("authors", [])]
            if not authors and "authors" in details:
                authors = [a.get("name", "") for a in details["authors"]]
                
            cover = raw.get("thumbnail_url", "")
            if cover:
                cover_url = cover.replace("-S.jpg", "-L.jpg")
            else:
                cover_url = None
                
            isbns = raw.get("identifiers", {})
            subjects = [s.get("name", "") for s in raw.get("subjects", [])]
            if not subjects and "subjects" in details:
                subjects = [s for s in details.get("subjects", []) if isinstance(s, str)]
                
            publishers = details.get("publishers", [])
            pub_dates = details.get("publish_date", "")
            ol_id = details.get("key", "").split("/")[-1]
            
            desc = _extract_description(details.get("description") or details.get("notes"))
            
            # If description is missing, try fetching it from the Work
            if not desc and "works" in details and len(details["works"]) > 0:
                work_key = details["works"][0].get("key")
                if work_key:
                    try:
                        work_r = await client.get(f"https://openlibrary.org{work_key}.json", timeout=10)
                        if work_r.status_code == 200:
                            work_data = work_r.json()
                            desc = _extract_description(work_data.get("description"))
                    except Exception:
                        pass
                        
            return {
                "title": details.get("title", raw.get("title", "Unknown")),
                "subtitle": details.get("subtitle", raw.get("subtitle")),
                "authors": authors,
                "description": desc,
                "isbn_10": (details.get("isbn_10") or [None])[0],
                "isbn_13": (details.get("isbn_13") or [None])[0] or isbn,
                "publisher": publishers[0] if publishers else None,
                "publication_date": str(pub_dates)[:4] if pub_dates else None,
                "page_count": details.get("number_of_pages"),
                "cover_url": cover_url,
                "language": None,
                "genres": subjects[:10],
                "open_library_id": ol_id,
                "google_books_id": None,
                "metadata_source": "open_library",
                "average_rating": None,
                "ratings_count": None,
            }
    except Exception:
        pass
    return None


async def _ol_search(query: str, client: httpx.AsyncClient, limit: int = 10) -> list[dict]:
    """Full-text search on Open Library."""
    try:
        r = await client.get(
            "https://openlibrary.org/search.json",
            params={"q": query, "limit": limit, "fields": "key,title,author_name,cover_i,isbn,first_publish_year,subject,publisher,number_of_pages,language"},
            timeout=10,
        )
        r.raise_for_status()
        docs = r.json().get("docs", [])
        return [_normalise_open_library(d) for d in docs]
    except Exception:
        return []


# ── Google Books ──────────────────────────────────────────────────────────────

async def _gb_isbn_lookup(isbn: str, client: httpx.AsyncClient) -> Optional[dict]:
    settings = get_settings()
    params = {"q": f"isbn:{isbn}"}
    if settings.google_books_api_key:
        params["key"] = settings.google_books_api_key
    try:
        r = await client.get("https://www.googleapis.com/books/v1/volumes", params=params, timeout=10)
        r.raise_for_status()
        items = r.json().get("items", [])
        if items:
            return _normalise_google_books(items[0])
    except Exception:
        pass
    return None


async def _gb_search(query: str, client: httpx.AsyncClient, limit: int = 10) -> list[dict]:
    settings = get_settings()
    params = {"q": query, "maxResults": limit}
    if settings.google_books_api_key:
        params["key"] = settings.google_books_api_key
    try:
        r = await client.get("https://www.googleapis.com/books/v1/volumes", params=params, timeout=10)
        r.raise_for_status()
        items = r.json().get("items", [])
        return [_normalise_google_books(i) for i in items]
    except Exception:
        return []


# ── Public API ────────────────────────────────────────────────────────────────

async def lookup_by_isbn(isbn: str) -> Optional[dict]:
    """Return book data for an ISBN, using cache then APIs."""
    redis = await _get_redis()
    cache_key = f"book:isbn:{isbn}"

    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    async with httpx.AsyncClient() as client:
        result = await _ol_isbn_lookup(isbn, client)
        
        # If OL returned nothing, or OL returned a book but it's missing a description,
        # fetch from Google Books to get/enrich the data.
        if not result or not result.get("description"):
            gb_result = await _gb_isbn_lookup(isbn, client)
            if gb_result:
                if not result:
                    result = gb_result
                else:
                    # Enrich existing OL result with GB data
                    result["description"] = gb_result.get("description") or result.get("description")
                    if not result.get("cover_url"):
                        result["cover_url"] = gb_result.get("cover_url")
                    if not result.get("page_count"):
                        result["page_count"] = gb_result.get("page_count")
                    if not result.get("average_rating"):
                        result["average_rating"] = gb_result.get("average_rating")

    if result:
        await redis.setex(cache_key, REDIS_CACHE_TTL, json.dumps(result))

    return result


async def search_books(query: str, limit: int = 10) -> list[dict]:
    """Search for books by title/author across APIs."""
    redis = await _get_redis()
    cache_key = f"search:{query[:100]}"

    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    async with httpx.AsyncClient() as client:
        ol_results, gb_results = await asyncio.gather(
            _ol_search(query, client, limit),
            _gb_search(query, client, limit // 2),
        )

    # Merge: prefer OL, fill gaps with GB results not duplicated by ISBN
    seen_isbns = set()
    merged = []
    for book in ol_results:
        isbn = book.get("isbn_13") or book.get("isbn_10")
        if isbn:
            seen_isbns.add(isbn)
        merged.append(book)

    for book in gb_results:
        isbn = book.get("isbn_13") or book.get("isbn_10")
        if isbn and isbn in seen_isbns:
            continue
        merged.append(book)

    results = merged[:limit]
    await redis.setex(cache_key, 3600, json.dumps(results))  # 1 hour for search
    return results
