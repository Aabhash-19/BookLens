"""
Recommendation engine.

Hybrid approach:
  A) Content similarity via pgvector (sentence-transformers embeddings)
  B) Genre / author affinity from user interactions
  C) Diversity injection (10% exploratory)

Scoring formula:
  score = 0.40 * semantic_sim
        + 0.25 * genre_match
        + 0.15 * author_affinity
        + 0.10 * popularity
        + 0.10 * diversity_bonus
        - disliked_penalty
        - already_read_penalty
"""
import asyncio
import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload

from app.models.book import Book, BookEmbedding, BookGenre, Genre, BookAuthor, Author
from app.models.user import User, UserPreference, UserEmbedding
from app.models.interaction import UserBookInteraction
from app.models.recommendation import Recommendation

# Lazy-load the embedding model to avoid slow startup
_embed_model = None

INTERACTION_WEIGHTS = {
    "favourited": 5.0,
    "finished": 4.0,
    "liked": 4.0,
    "reading": 2.0,
    "want_to_read": 1.5,
    "scanned": 1.0,
    "disliked": -4.0,
    "not_interested": -4.0,
}

PREFERENCE_WEIGHTS = {
    "genre": 1.0,
    "author": 0.8,
    "language": 0.5,
}


def _get_embed_model():
    global _embed_model
    if _embed_model is None:
        from sentence_transformers import SentenceTransformer
        _embed_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    return _embed_model


def _book_text(book: Book) -> str:
    """Build a combined text representation of a book for embedding."""
    parts = [book.title or ""]
    if book.subtitle:
        parts.append(book.subtitle)
    if book.description:
        parts.append(book.description[:500])
    return " ".join(parts)


async def compute_book_embedding(book: Book) -> list[float]:
    """Generate a 384-dim embedding for a book using sentence-transformers."""
    loop = asyncio.get_event_loop()
    text = _book_text(book)
    model = _get_embed_model()
    embedding = await loop.run_in_executor(None, lambda: model.encode(text).tolist())
    return embedding


async def upsert_book_embedding(db: AsyncSession, book: Book) -> None:
    """Compute and persist a BookEmbedding row."""
    embedding = await compute_book_embedding(book)
    result = await db.execute(select(BookEmbedding).where(BookEmbedding.book_id == book.id))
    be = result.scalar_one_or_none()
    if be:
        be.text_embedding = embedding
    else:
        db.add(BookEmbedding(book_id=book.id, text_embedding=embedding))
    await db.flush()


async def update_user_embedding(db: AsyncSession, user_id: uuid.UUID) -> None:
    """
    Build a preference vector for the user by averaging liked-book embeddings
    and explicit user preferences, weighted by interaction signal, then store it as UserEmbedding.
    """
    weighted_sum = None
    total_weight = 0.0

    # 1. Fetch interactions with weights
    result = await db.execute(
        select(UserBookInteraction, BookEmbedding)
        .join(BookEmbedding, BookEmbedding.book_id == UserBookInteraction.book_id)
        .where(UserBookInteraction.user_id == user_id)
    )
    rows = result.all()

    for interaction, be in rows:
        weight = INTERACTION_WEIGHTS.get(interaction.interaction_type, 0.0)
        if weight == 0.0 or be.text_embedding is None:
            continue
        vec = be.text_embedding
        if weighted_sum is None:
            weighted_sum = [v * weight for v in vec]
        else:
            weighted_sum = [s + v * weight for s, v in zip(weighted_sum, vec)]
        total_weight += abs(weight)

    # 2. Fetch explicit preferences
    prefs_result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == user_id)
    )
    prefs = prefs_result.scalars().all()
    if prefs:
        genres = [p.preference_value for p in prefs if p.preference_type == "genre"]
        authors = [p.preference_value for p in prefs if p.preference_type == "author"]
        langs = [p.preference_value for p in prefs if p.preference_type == "language"]
        
        pref_text_parts = []
        if genres: pref_text_parts.append(f"Genres: {', '.join(genres)}")
        if authors: pref_text_parts.append(f"Authors: {', '.join(authors)}")
        if langs: pref_text_parts.append(f"Languages: {', '.join(langs)}")
        
        if pref_text_parts:
            pref_text = "Preferred " + ". ".join(pref_text_parts) + "."
            loop = asyncio.get_event_loop()
            model = _get_embed_model()
            pref_vec = await loop.run_in_executor(None, lambda: model.encode(pref_text).tolist())
            
            # Weight explicit preferences heavily
            weight = 5.0
            if weighted_sum is None:
                weighted_sum = [v * weight for v in pref_vec]
            else:
                weighted_sum = [s + v * weight for s, v in zip(weighted_sum, pref_vec)]
            total_weight += weight

    if not weighted_sum or total_weight == 0:
        return

    avg_vec = [v / total_weight for v in weighted_sum]

    result = await db.execute(select(UserEmbedding).where(UserEmbedding.user_id == user_id))
    ue = result.scalar_one_or_none()
    if ue:
        ue.preference_embedding = avg_vec
    else:
        db.add(UserEmbedding(user_id=user_id, preference_embedding=avg_vec))
    await db.flush()


def explain_recommendation(book_genres: list[str], user_preferences: list[UserPreference], authors: list[str]) -> str:
    """Generate a human-readable explanation string."""
    reasons = []
    pref_genres = {p.preference_value.lower() for p in user_preferences if p.preference_type == "genre"}
    pref_authors = {p.preference_value.lower() for p in user_preferences if p.preference_type == "author"}

    matched_genres = [g for g in book_genres if g.lower() in pref_genres]
    matched_authors = [a for a in authors if a.lower() in pref_authors]

    if matched_genres:
        reasons.append(f"you enjoy {', '.join(matched_genres[:2])}")
    if matched_authors:
        reasons.append(f"you like books by {', '.join(matched_authors[:1])}")
    if not reasons:
        reasons.append("it matches your reading taste")

    return "Recommended because " + " and ".join(reasons) + "."


async def generate_recommendations(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 20,
    filters: dict = None
) -> list[Recommendation]:
    """
    Generate personalised recommendations using pgvector similarity.
    Falls back to genre-matching if the user has no embedding yet.
    """
    if filters is None: filters = {}
    # Fetch user's preference embedding
    result = await db.execute(select(UserEmbedding).where(UserEmbedding.user_id == user_id))
    ue = result.scalar_one_or_none()

    # Books already interacted with
    interacted_result = await db.execute(
        select(UserBookInteraction.book_id).where(UserBookInteraction.user_id == user_id)
    )
    interacted_ids = {row[0] for row in interacted_result.all()}

    # Disliked books
    disliked_result = await db.execute(
        select(UserBookInteraction.book_id).where(
            UserBookInteraction.user_id == user_id,
            UserBookInteraction.interaction_type.in_(["disliked", "not_interested"])
        )
    )
    disliked_ids = {row[0] for row in disliked_result.all()}

    # Fetch explicit user preferences to boost recommendations
    user_prefs_result = await db.execute(select(UserPreference).where(UserPreference.user_id == user_id))
    user_prefs_list = user_prefs_result.scalars().all()
    pref_authors = {p.preference_value.lower() for p in user_prefs_list if p.preference_type == "author"}
    pref_genres = {p.preference_value.lower() for p in user_prefs_list if p.preference_type == "genre"}
    pref_langs = {p.preference_value.lower() for p in user_prefs_list if p.preference_type == "language"}

    # ── Semantic similarity query ─────────────────────────────────────────────
    candidate_books = []
    if ue and ue.preference_embedding:
        # Use pgvector <=> cosine distance operator
        embedding_str = "[" + ",".join(str(x) for x in ue.preference_embedding) + "]"
        
        base_sql = "SELECT b.id, (be.text_embedding <=> CAST(:emb AS vector)) AS distance FROM books b JOIN book_embeddings be ON be.book_id = b.id "
        joins = []
        wheres = ["b.id != ALL(:excluded)", "b.cover_url IS NOT NULL", "b.cover_url != ''"]
        params = {
            "emb": embedding_str,
            "excluded": list(disliked_ids) or [uuid.uuid4()],
            "limit": limit * 10,
        }

        if filters.get("language"):
            lang_query = filters["language"].strip().lower()
            lang_map = {
                "english": "eng", "french": "fre", "german": "ger", 
                "italian": "ita", "portuguese": "por", "polish": "pol", 
                "chinese": "chi", "hebrew": "heb", "spanish": "spa"
            }
            mapped_lang = lang_map.get(lang_query, lang_query)
            wheres.append("(b.language ILIKE :language OR b.language ILIKE :language_raw)")
            params["language"] = f"%{mapped_lang}%"
            params["language_raw"] = f"%{lang_query}%"
        if filters.get("title"):
            wheres.append("b.title ILIKE :title")
            params["title"] = f"%{filters['title']}%"
        if filters.get("author"):
            joins.append("JOIN book_authors ba ON ba.book_id = b.id JOIN authors a ON a.id = ba.author_id")
            wheres.append("a.name ILIKE :author")
            params["author"] = f"%{filters['author']}%"
        if filters.get("genre"):
            joins.append("JOIN book_genres bg ON bg.book_id = b.id JOIN genres g ON g.id = bg.genre_id")
            wheres.append("g.name ILIKE :genre")
            params["genre"] = f"%{filters['genre']}%"

        sql_str = base_sql + " ".join(joins) + " WHERE " + " AND ".join(wheres) + " ORDER BY distance ASC LIMIT :limit"
        sql = text(sql_str)
        rows = await db.execute(sql, params)
        book_distances = {row[0]: row[1] for row in rows.all()}
        if book_distances:
            result = await db.execute(
                select(Book).where(Book.id.in_(list(book_distances.keys())))
                .options(selectinload(Book.authors), selectinload(Book.genres))
            )
            candidate_books = result.scalars().all()
            
            # Re-rank based on explicit preferences
            def score_book(b):
                sim = 1.0 - (book_distances.get(b.id, 1.0) / 2.0)
                score = sim
                b_authors = {a.name.lower() for a in b.authors}
                if b_authors & pref_authors:
                    score += 0.5  # Massive boost for explicitly preferred authors
                    
                b_genres = {g.name.lower() for g in b.genres}
                if b_genres & pref_genres:
                    score += 0.2
                    
                if b.language and b.language.lower() in pref_langs:
                    score += 0.1
                    
                return score
                
            candidate_books.sort(key=score_book, reverse=True)
            candidate_books = candidate_books[:limit]
    else:
        # Cold start: return popular books from preferred genres
        if pref_genres or filters:
            q = select(Book)
            
            if filters.get("genre") or pref_genres:
                q = q.join(BookGenre).join(Genre)
                if filters.get("genre"):
                    q = q.where(Genre.name.ilike(f"%{filters['genre']}%"))
                else:
                    q = q.where(Genre.name.in_(pref_genres))
                    
            if filters.get("title"):
                q = q.where(Book.title.ilike(f"%{filters['title']}%"))
            if filters.get("author"):
                q = q.join(BookAuthor).join(Author).where(Author.name.ilike(f"%{filters['author']}%"))
            if filters.get("language"):
                lang_query = filters["language"].strip().lower()
                lang_map = {
                    "english": "eng", "french": "fre", "german": "ger", 
                    "italian": "ita", "portuguese": "por", "polish": "pol", 
                    "chinese": "chi", "hebrew": "heb", "spanish": "spa"
                }
                mapped_lang = lang_map.get(lang_query, lang_query)
                q = q.where(
                    Book.language.ilike(f"%{mapped_lang}%") | 
                    Book.language.ilike(f"%{lang_query}%")
                )

            q = q.where(
                Book.id.notin_(disliked_ids or [uuid.uuid4()]),
                Book.cover_url.is_not(None),
                Book.cover_url != ''
            ).order_by(Book.average_rating.desc().nullslast()).limit(limit).options(selectinload(Book.authors), selectinload(Book.genres))
            
            result = await db.execute(q)
            candidate_books = result.scalars().unique().all()
            
            # If not enough books found locally, seed from external API
            if len(candidate_books) < limit and not filters:
                from app.services.book_lookup import search_books
                from app.services.scan_processor import _upsert_book
                
                for genre in pref_genres:
                    try:
                        results = await search_books(genre, limit=10)
                        for res in results:
                            if res.get("cover_url"):
                                book = await _upsert_book(db, res)
                                await upsert_book_embedding(db, book)
                                if not any(b.id == book.id for b in candidate_books):
                                    candidate_books.append(book)
                            if len(candidate_books) >= limit:
                                break
                    except Exception:
                        pass
                    if len(candidate_books) >= limit:
                        break

            # Reload candidate books to eagerly fetch authors and genres
            if candidate_books:
                candidate_ids = [b.id for b in candidate_books]
                result = await db.execute(
                    select(Book)
                    .where(Book.id.in_(candidate_ids))
                    .options(selectinload(Book.authors), selectinload(Book.genres))
                )
                candidate_books = list(result.scalars().all())

        if not candidate_books:
            # Absolute cold start: return highly-rated books
            q = select(Book)
            if filters.get("title"):
                q = q.where(Book.title.ilike(f"%{filters['title']}%"))
            if filters.get("genre"):
                q = q.join(BookGenre).join(Genre).where(Genre.name.ilike(f"%{filters['genre']}%"))
            if filters.get("author"):
                q = q.join(BookAuthor).join(Author).where(Author.name.ilike(f"%{filters['author']}%"))
            if filters.get("language"):
                lang_query = filters["language"].strip().lower()
                lang_map = {
                    "english": "eng", "french": "fre", "german": "ger", 
                    "italian": "ita", "portuguese": "por", "polish": "pol", 
                    "chinese": "chi", "hebrew": "heb", "spanish": "spa"
                }
                mapped_lang = lang_map.get(lang_query, lang_query)
                q = q.where(
                    Book.language.ilike(f"%{mapped_lang}%") | 
                    Book.language.ilike(f"%{lang_query}%")
                )
                
            q = q.where(
                Book.id.notin_(interacted_ids),
                Book.cover_url.is_not(None),
                Book.cover_url != ''
            ).order_by(Book.average_rating.desc().nullslast()).limit(limit).options(selectinload(Book.authors), selectinload(Book.genres))
            
            result = await db.execute(q)
            candidate_books = result.scalars().all()

            if len(candidate_books) < limit and not filters:
                from app.services.book_lookup import search_books
                from app.services.scan_processor import _upsert_book
                try:
                    results = await search_books("bestsellers", limit=10)
                    for res in results:
                        if res.get("cover_url"):
                            book = await _upsert_book(db, res)
                            await upsert_book_embedding(db, book)
                            if not any(b.id == book.id for b in candidate_books):
                                candidate_books.append(book)
                        if len(candidate_books) >= limit:
                            break
                except Exception:
                    pass

            # Reload candidate books for absolute cold start too
            if candidate_books:
                candidate_ids = [b.id for b in candidate_books]
                result = await db.execute(
                    select(Book)
                    .where(Book.id.in_(candidate_ids))
                    .options(selectinload(Book.authors), selectinload(Book.genres))
                )
                candidate_books = list(result.scalars().all())

    # On-demand seeding if filters are applied and candidates are low
    if len(candidate_books) < limit and (filters.get("author") or filters.get("genre") or filters.get("language") or filters.get("title")):
        import httpx
        from app.services.book_lookup import _normalise_open_library
        from app.services.scan_processor import _upsert_book
        
        ol_params = {"limit": 35, "fields": "key,title,author_name,cover_i,isbn,first_publish_year,subject,publisher,number_of_pages,language"}
        
        # Resolve language code for Open Library API
        mapped_lang = None
        if filters.get("language"):
            lang_query = filters["language"].strip().lower()
            lang_map = {
                "english": "eng", "french": "fre", "german": "ger", 
                "italian": "ita", "portuguese": "por", "polish": "pol", 
                "chinese": "chi", "hebrew": "heb", "spanish": "spa",
                "dutch": "dut", "russian": "rus", "japanese": "jpn",
                "korean": "kor", "arabic": "ara", "swedish": "swe",
                "hindi": "hin", "latin": "lat"
            }
            mapped_lang = lang_map.get(lang_query, lang_query)
            
        has_filter = False
        
        # Build Open Library search parameters dynamically based on all filters
        if filters.get("author"):
            ol_params["author"] = filters["author"]
            if mapped_lang:
                ol_params["language"] = mapped_lang
            if filters.get("title"):
                ol_params["title"] = filters["title"]
            has_filter = True
        elif filters.get("genre"):
            ol_params["subject"] = filters["genre"]
            if mapped_lang:
                ol_params["language"] = mapped_lang
            if filters.get("title"):
                ol_params["title"] = filters["title"]
            has_filter = True
        elif filters.get("title"):
            ol_params["title"] = filters["title"]
            if mapped_lang:
                ol_params["language"] = mapped_lang
            has_filter = True
        elif mapped_lang:
            ol_params["q"] = f"language:{mapped_lang}"
            has_filter = True
            
        if has_filter:
            try:
                async with httpx.AsyncClient() as client:
                    r = await client.get("https://openlibrary.org/search.json", params=ol_params, timeout=10)
                    if r.status_code == 200:
                        docs = r.json().get("docs", [])
                        new_books = []
                        for doc in docs:
                            book_data = _normalise_open_library(doc)
                            if book_data.get("cover_url"):
                                book = await _upsert_book(db, book_data)
                                await upsert_book_embedding(db, book)
                                new_books.append(book)
                        
                        if new_books:
                            new_ids = [b.id for b in new_books]
                            result = await db.execute(
                                select(Book)
                                .where(Book.id.in_(new_ids))
                                .options(selectinload(Book.authors), selectinload(Book.genres))
                            )
                            loaded_new_books = list(result.scalars().all())
                            for b in loaded_new_books:
                                if not any(cb.id == b.id for cb in candidate_books):
                                    candidate_books.append(b)
            except Exception:
                pass

    # Fetch user preferences for explanation generation
    prefs_result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == user_id)
    )
    user_prefs = prefs_result.scalars().all()

    # Deduplicate candidates by normalized title to prevent same book multiple times
    seen_titles = set()
    deduped_candidates = []
    import re
    for book in candidate_books:
        # Normalize title: lowercase, take part before '/', ':', or '(', strip whitespace
        title = (book.title or "").strip().lower()
        title = re.split(r'[/:(]', title)[0].strip()
        
        if title not in seen_titles:
            seen_titles.add(title)
            deduped_candidates.append(book)
    candidate_books = deduped_candidates

    # Concurrently fetch Wikipedia descriptions for any books missing them
    from app.services.book_lookup import get_wikipedia_summary
    async def _enrich_book(b: Book):
        if not b.description or len(b.description) < 150:
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
                
    await asyncio.gather(*[_enrich_book(b) for b in candidate_books[:limit]])
    await db.flush()

    # ── Build Recommendation rows ─────────────────────────────────────────────
    recommendations = []
    for book in candidate_books[:limit]:
        genres = [g.name for g in book.genres]
        authors = [a.name for a in book.authors]
        reason = explain_recommendation(genres, user_prefs, authors)

        rec = Recommendation(
            user_id=user_id,
            book_id=book.id,
            score=0.75,  # placeholder; refined by scoring formula in future
            reason=reason,
            model_version="1.0",
        )
        db.add(rec)
        recommendations.append(rec)

    await db.flush()
    return recommendations
