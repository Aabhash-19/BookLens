"""
Books routes.

GET /books/search?q=...
GET /books/isbn/{isbn}
GET /books/{id}
GET /books/{id}/similar
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user_optional
from app.models.user import User
from app.models.book import Book, BookEmbedding
from app.schemas.book import BookResponse, BookSearchResult
from app.services import book_lookup, scan_processor

router = APIRouter()


@router.get("/search", response_model=List[BookSearchResult])
async def search_books(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, le=30),
    db: AsyncSession = Depends(get_db),
):
    """Search for books by title or author across Open Library and Google Books."""
    results = await book_lookup.search_books(q, limit=limit)
    return [
        BookSearchResult(
            title=b.get("title", ""),
            authors=b.get("authors", []),
            cover_url=b.get("cover_url"),
            isbn_13=b.get("isbn_13"),
            isbn_10=b.get("isbn_10"),
            description=b.get("description"),
            publisher=b.get("publisher"),
            metadata_source=b.get("metadata_source"),
        )
        for b in results
    ]


@router.get("/isbn/{isbn}", response_model=BookSearchResult)
async def get_by_isbn(isbn: str, db: AsyncSession = Depends(get_db)):
    """Look up a book by ISBN. Returns enriched metadata."""
    data = await book_lookup.lookup_by_isbn(isbn)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found for this ISBN.")
    return BookSearchResult(
        title=data.get("title", ""),
        authors=data.get("authors", []),
        cover_url=data.get("cover_url"),
        isbn_13=data.get("isbn_13"),
        isbn_10=data.get("isbn_10"),
        description=data.get("description"),
        publisher=data.get("publisher"),
        metadata_source=data.get("metadata_source"),
    )


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(book_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return full book detail including authors and genres."""
    result = await db.execute(
        select(Book)
        .where(Book.id == book_id)
        .options(selectinload(Book.authors), selectinload(Book.genres))
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")

    # Lazy-load/enrich description if missing or too short
    if not book.description or len(book.description) < 300:
        author_name = book.authors[0].name if book.authors else ""
        wiki_desc = await book_lookup.get_wikipedia_summary(book.title, author_name)
        
        if wiki_desc and len(wiki_desc) > len(book.description or ""):
            book.description = wiki_desc
            db.add(book)
            await db.commit()
            await db.refresh(book)
        elif not book.description and (book.isbn_13 or book.isbn_10):
            isbn = book.isbn_13 or book.isbn_10
            data = await book_lookup.lookup_by_isbn(isbn)
            if data and data.get("description"):
                book.description = data["description"]
                db.add(book)
                await db.commit()
                await db.refresh(book)

    return book


@router.get("/{book_id}/similar", response_model=List[BookResponse])
async def get_similar_books(
    book_id: uuid.UUID,
    limit: int = Query(6, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Return semantically similar books using pgvector cosine distance."""
    # Get the source book's embedding
    emb_result = await db.execute(
        select(BookEmbedding).where(BookEmbedding.book_id == book_id)
    )
    be = emb_result.scalar_one_or_none()

    if not be or be.text_embedding is None:
        # Fallback: return books sharing genres
        book_result = await db.execute(
            select(Book).where(Book.id == book_id).options(selectinload(Book.genres))
        )
        book = book_result.scalar_one_or_none()
        if not book:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")

        from app.models.book import BookGenre, Genre
        genre_ids = [g.id for g in book.genres]
        if not genre_ids:
            return []

        result = await db.execute(
            select(Book)
            .join(BookGenre)
            .where(BookGenre.genre_id.in_(genre_ids), Book.id != book_id)
            .limit(limit)
            .options(selectinload(Book.authors), selectinload(Book.genres))
        )
        return result.scalars().unique().all()

    embedding_str = "[" + ",".join(str(x) for x in be.text_embedding) + "]"
    sql = text("""
        SELECT b.id
        FROM books b
        JOIN book_embeddings be ON be.book_id = b.id
        WHERE b.id != :book_id
        ORDER BY be.text_embedding <=> CAST(:emb AS vector) ASC
        LIMIT :limit
    """)
    rows = await db.execute(sql, {"book_id": str(book_id), "emb": embedding_str, "limit": limit})
    similar_ids = [row[0] for row in rows.all()]

    if not similar_ids:
        return []

    result = await db.execute(
        select(Book)
        .where(Book.id.in_(similar_ids))
        .options(selectinload(Book.authors), selectinload(Book.genres))
    )
    books = result.scalars().all()
    # Maintain the order from the distance query
    id_order = {bid: i for i, bid in enumerate(similar_ids)}
    books.sort(key=lambda b: id_order.get(b.id, 999))
    return books
