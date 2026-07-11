"""
Recommendations routes.

GET  /recommendations              ← personalised feed
POST /recommendations/{id}/feedback ← user signals interest/dismissal
"""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.book import Book, Author, Genre
from app.models.recommendation import Recommendation
from app.schemas.book import RecommendationResponse, RecommendationFeedback
from app.services.recommendation import generate_recommendations

router = APIRouter()


@router.get("/suggest", response_model=List[str])
async def get_filter_suggestions(
    q: str = Query("", description="Search query"),
    type: str = Query("author", description="Type: author, genre, language"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search and return autocomplete suggestions for authors, genres, and languages.
    """
    if not q or len(q) < 1:
        return []
    
    if type == "author":
        result = await db.execute(
            select(Author.name)
            .where(Author.name.ilike(f"%{q}%"))
            .order_by(Author.name)
            .limit(10)
        )
        local_authors = list(result.scalars().all())
        
        # Fallback to Open Library Author Search if local matches are low
        if len(local_authors) < 5:
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    r = await client.get(f"https://openlibrary.org/search/authors.json?q={q}", timeout=5)
                    if r.status_code == 200:
                        docs = r.json().get("docs", [])
                        for doc in docs[:10]:
                            name = doc.get("name")
                            if name and name not in local_authors:
                                local_authors.append(name)
            except Exception:
                pass
        return local_authors[:10]
        
    elif type == "genre":
        result = await db.execute(
            select(Genre.name)
            .where(Genre.name.ilike(f"%{q}%"))
            .order_by(Genre.name)
            .limit(10)
        )
        local_genres = list(result.scalars().all())
        
        # Merge with a list of popular standard genres for robustness
        popular_genres = [
            "Fantasy", "Science Fiction", "Sci-Fi", "Horror", "Romance", "Classics",
            "Adventure", "Historical Fiction", "Mystery", "Thriller", "Biography",
            "Autobiography", "History", "Non-fiction", "Poetry", "Drama", "Self-Help",
            "Philosophy", "Psychology", "Science", "Business", "Art", "Travel"
        ]
        matched_popular = [g for g in popular_genres if q.lower() in g.lower()]
        
        for g in matched_popular:
            if g not in local_genres:
                local_genres.append(g)
                
        # Fallback to Open Library Subject Search if local/popular matches are low
        if len(local_genres) < 5:
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    r = await client.get(f"https://openlibrary.org/search.json?q=subject:{q}&limit=10", timeout=5)
                    if r.status_code == 200:
                        docs = r.json().get("docs", [])
                        for doc in docs:
                            for subj in doc.get("subject", []):
                                if q.lower() in subj.lower() and subj not in local_genres:
                                    local_genres.append(subj)
            except Exception:
                pass
                
        return local_genres[:10]
        
    elif type == "language":
        languages = [
            "English", "French", "German", "Italian", "Portuguese", 
            "Polish", "Chinese", "Hebrew", "Spanish", "Dutch", 
            "Russian", "Japanese", "Korean", "Arabic", "Swedish", 
            "Hindi", "Latin"
        ]
        return [l for l in languages if q.lower() in l.lower()][:5]
    elif type == "book":
        result = await db.execute(
            select(Book.title)
            .where(Book.title.ilike(f"%{q}%"))
            .order_by(Book.title)
            .limit(10)
        )
        local_books = list(result.scalars().all())
        
        # Fallback to Open Library Book Search if local matches are low
        if len(local_books) < 5:
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    r = await client.get(f"https://openlibrary.org/search.json?title={q}&limit=10", timeout=5)
                    if r.status_code == 200:
                        docs = r.json().get("docs", [])
                        for doc in docs[:10]:
                            title = doc.get("title")
                            if title and title not in local_books:
                                local_books.append(title)
            except Exception:
                pass
        return local_books[:10]
    
    return []



async def _enrich_recs_descriptions(recs: List[Recommendation], db: AsyncSession):
    import asyncio
    from app.services.book_lookup import get_wikipedia_summary
    async def _enrich_single(rec):
        b = rec.book
        if b and (not b.description or len(b.description) < 150):
            # 1. Try Wikipedia
            author_name = b.authors[0].name if b.authors else ""
            wiki_desc = await get_wikipedia_summary(b.title, author_name)
            if wiki_desc and len(wiki_desc) > len(b.description or ""):
                b.description = wiki_desc
                db.add(b)
                return
                
            # 2. Try Open Library Work API fallback
            if b.open_library_id:
                try:
                    import httpx
                    from app.services.book_lookup import _extract_description
                    async with httpx.AsyncClient() as client:
                        r = await client.get(f"https://openlibrary.org/works/{b.open_library_id}.json", timeout=10)
                        if r.status_code == 200:
                            data = r.json()
                            ol_desc = _extract_description(data.get("description"))
                            if ol_desc and len(ol_desc) > len(b.description or ""):
                                b.description = ol_desc
                                db.add(b)
                except Exception:
                    pass
    
    if recs:
        await asyncio.gather(*[_enrich_single(r) for r in recs])
        await db.flush()


@router.get("", response_model=List[RecommendationResponse])
async def get_recommendations(
    limit: int = Query(20, le=50),
    refresh: bool = Query(False, description="Generate fresh recommendations"),
    author: str = Query(None, description="Filter by author"),
    genre: str = Query(None, description="Filter by genre"),
    language: str = Query(None, description="Filter by language"),
    title: str = Query(None, description="Filter by title / book name"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return personalised book recommendations for the current user.
    Generates fresh ones if none exist or refresh=True.
    """
    filters = {}
    if author: filters["author"] = author
    if genre: filters["genre"] = genre
    if language: filters["language"] = language
    if title: filters["title"] = title
    
    # Check for existing unseen recommendations ONLY if we aren't refreshing and have NO filters
    if not refresh and not filters:
        existing_result = await db.execute(
            select(Recommendation)
            .where(
                Recommendation.user_id == current_user.id,
                Recommendation.dismissed_at.is_(None),
            )
            .options(
                selectinload(Recommendation.book).selectinload(Book.authors),
                selectinload(Recommendation.book).selectinload(Book.genres),
            )
            .order_by(Recommendation.score.desc())
            .limit(limit)
        )
        existing = existing_result.scalars().all()

        if existing:
            # Mark as shown
            for rec in existing:
                if rec.shown_at is None:
                    rec.shown_at = datetime.utcnow()
            await _enrich_recs_descriptions(existing, db)
            await db.flush()
            return [_rec_to_response(r) for r in existing]

    # Generate new recommendations
    new_recs = await generate_recommendations(db, current_user.id, limit=limit, filters=filters)
    if not new_recs:
        return []

    # Fetch with relationships loaded
    rec_ids = [r.id for r in new_recs]
    result = await db.execute(
        select(Recommendation)
        .where(Recommendation.id.in_(rec_ids))
        .options(
            selectinload(Recommendation.book).selectinload(Book.authors),
            selectinload(Recommendation.book).selectinload(Book.genres),
        )
    )
    recs = result.scalars().all()

    # Mark shown
    for rec in recs:
        rec.shown_at = datetime.utcnow()
    await _enrich_recs_descriptions(recs, db)
    await db.flush()

    return [_rec_to_response(r) for r in recs]


@router.post("/{recommendation_id}/feedback", status_code=status.HTTP_200_OK)
async def submit_feedback(
    recommendation_id: uuid.UUID,
    payload: RecommendationFeedback,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Record user feedback on a recommendation.
    Actions: clicked | dismissed | not_interested
    """
    result = await db.execute(
        select(Recommendation).where(
            Recommendation.id == recommendation_id,
            Recommendation.user_id == current_user.id,
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found.")

    now = datetime.utcnow()
    if payload.action == "clicked":
        rec.clicked_at = now
    elif payload.action in ("dismissed", "not_interested"):
        rec.dismissed_at = now

    await db.flush()
    return {"status": "ok", "action": payload.action}


# ── Helper ────────────────────────────────────────────────────────────────────

def _rec_to_response(rec: Recommendation) -> RecommendationResponse:
    return RecommendationResponse(
        id=rec.id,
        book=rec.book,
        score=rec.score,
        reason=rec.reason,
        shown_at=rec.shown_at,
        created_at=rec.created_at,
    )
