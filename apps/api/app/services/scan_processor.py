"""
Scan processing pipeline.

Orchestrates:
  1. Image preprocessing
  2. Barcode detection → ISBN lookup
  3. OCR → title/author search
  4. Candidate ranking
  5. DB persistence (BookScan + Book upsert)
  6. Storage upload
"""
import uuid
from datetime import date, datetime
from typing import Optional
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.book import Book, Author, BookAuthor, Genre, BookGenre
from app.models.scan import BookScan
from app.services import image_processing as ip
from app.services import book_lookup, storage


@dataclass
class ScanCandidate:
    title: str
    authors: list[str]
    cover_url: Optional[str]
    isbn_13: Optional[str]
    isbn_10: Optional[str]
    confidence: float
    metadata_source: str
    raw: dict = field(default_factory=dict)


@dataclass
class ScanResult:
    scan_id: uuid.UUID
    status: str  # identified | needs_confirmation | failed
    recognition_method: Optional[str]
    candidates: list[ScanCandidate]
    identified_book_id: Optional[uuid.UUID] = None
    ocr_text: Optional[str] = None
    detected_isbn: Optional[str] = None


async def process_scan(
    db: AsyncSession,
    user_id: uuid.UUID,
    raw_bytes: bytes,
) -> ScanResult:
    """
    Full scan pipeline. Returns a ScanResult with status and candidates.
    Persists BookScan row and uploads images to MinIO.
    """
    # ── 1. Preprocess ─────────────────────────────────────────────────────────
    img = await ip.async_preprocess(raw_bytes)
    webp_bytes = ip.encode_webp(img)
    thumb_bytes = ip.make_thumbnail(img)

    # ── 2. Upload images ──────────────────────────────────────────────────────
    img_path = storage.build_scan_path(str(user_id))
    thumb_path = storage.build_scan_path(str(user_id), "-thumb")
    await storage.upload_bytes(webp_bytes, img_path)
    await storage.upload_bytes(thumb_bytes, thumb_path)

    # ── 3. Create pending scan row ────────────────────────────────────────────
    scan = BookScan(
        user_id=user_id,
        image_path=img_path,
        thumbnail_path=thumb_path,
        scan_status="processing",
    )
    db.add(scan)
    await db.flush()
    await db.refresh(scan)

    # ── 4. Barcode detection ──────────────────────────────────────────────────
    isbn = await ip.async_detect_barcode(img)
    if isbn:
        book_data = await book_lookup.lookup_by_isbn(isbn)
        if book_data:
            book = await _upsert_book(db, book_data)
            await _finalise_scan(db, scan, "identified", "barcode", isbn=isbn, book=book)
            return ScanResult(
                scan_id=scan.id,
                status="identified",
                recognition_method="barcode",
                candidates=[_book_to_candidate(book_data, confidence=1.0)],
                identified_book_id=book.id,
                detected_isbn=isbn,
            )

    # ── 5. OCR ────────────────────────────────────────────────────────────────
    ocr_result = await ip.async_run_ocr(img)
    raw_text = ocr_result.get("raw_text", "")
    possible_title = ocr_result.get("possible_title") or ""
    possible_author = ocr_result.get("possible_author") or ""

    query = f"{possible_title} {possible_author}".strip()
    candidates_raw = []
    if query:
        candidates_raw = await book_lookup.search_books(query, limit=5)

    candidates = [_book_to_candidate(b, confidence=_score(b, possible_title, possible_author)) for b in candidates_raw]
    candidates.sort(key=lambda c: c.confidence, reverse=True)

    if candidates and candidates[0].confidence >= 0.75:
        # High confidence → auto-identify
        best = candidates[0]
        book = await _upsert_book(db, best.raw)
        await _finalise_scan(db, scan, "identified", "ocr", ocr_text=raw_text, book=book)
        return ScanResult(
            scan_id=scan.id,
            status="identified",
            recognition_method="ocr",
            candidates=candidates,
            identified_book_id=book.id,
            ocr_text=raw_text,
        )
    elif candidates:
        await _finalise_scan(db, scan, "needs_confirmation", "ocr", ocr_text=raw_text)
        return ScanResult(
            scan_id=scan.id,
            status="needs_confirmation",
            recognition_method="ocr",
            candidates=candidates,
            ocr_text=raw_text,
        )
    else:
        await _finalise_scan(db, scan, "failed", None, ocr_text=raw_text)
        return ScanResult(
            scan_id=scan.id,
            status="failed",
            recognition_method=None,
            candidates=[],
            ocr_text=raw_text,
        )


async def confirm_scan(
    db: AsyncSession,
    scan: BookScan,
    book_data: dict,
) -> BookScan:
    """User manually picks/confirms which book was scanned."""
    book = await _upsert_book(db, book_data)
    scan.identified_book_id = book.id
    scan.scan_status = "identified"
    scan.recognition_method = "user_confirmation"
    await db.flush()
    return scan


# ── Private helpers ───────────────────────────────────────────────────────────

async def _finalise_scan(
    db: AsyncSession,
    scan: BookScan,
    status: str,
    method: Optional[str],
    isbn: Optional[str] = None,
    ocr_text: Optional[str] = None,
    book: Optional[Book] = None,
) -> None:
    scan.scan_status = status
    scan.recognition_method = method
    scan.detected_isbn = isbn
    scan.ocr_text = ocr_text
    if book:
        scan.identified_book_id = book.id
    await db.flush()


def _score(book_data: dict, title_hint: str, author_hint: str) -> float:
    """Simple string-match confidence score."""
    score = 0.5
    bk_title = (book_data.get("title") or "").lower()
    bk_authors = " ".join(book_data.get("authors") or []).lower()
    if title_hint and title_hint.lower() in bk_title:
        score += 0.3
    if author_hint and author_hint.lower() in bk_authors:
        score += 0.2
    return min(score, 1.0)


def _book_to_candidate(book_data: dict, confidence: float) -> ScanCandidate:
    return ScanCandidate(
        title=book_data.get("title", ""),
        authors=book_data.get("authors", []),
        cover_url=book_data.get("cover_url"),
        isbn_13=book_data.get("isbn_13"),
        isbn_10=book_data.get("isbn_10"),
        confidence=round(confidence, 3),
        metadata_source=book_data.get("metadata_source", "open_library"),
        raw=book_data,
    )


async def _upsert_book(db: AsyncSession, data: dict) -> Book:
    """Create or update a Book row from normalised book data."""
    # Try to find existing by ISBN
    isbn_13 = data.get("isbn_13")
    isbn_10 = data.get("isbn_10")
    book = None

    if isbn_13:
        result = await db.execute(select(Book).where(Book.isbn_13 == isbn_13))
        book = result.scalar_one_or_none()
    if not book and isbn_10:
        result = await db.execute(select(Book).where(Book.isbn_10 == isbn_10))
        book = result.scalar_one_or_none()
    if not book:
        result = await db.execute(select(Book).where(Book.title == data.get("title", "")))
        book = result.scalar_one_or_none()

    if not book:
        book = Book(
            title=data.get("title", "Unknown"),
            subtitle=data.get("subtitle"),
            description=data.get("description"),
            isbn_10=isbn_10,
            isbn_13=isbn_13,
            publisher=data.get("publisher"),
            page_count=data.get("page_count"),
            cover_url=data.get("cover_url"),
            language=data.get("language"),
            open_library_id=data.get("open_library_id"),
            google_books_id=data.get("google_books_id"),
            metadata_source=data.get("metadata_source"),
            average_rating=data.get("average_rating"),
            ratings_count=data.get("ratings_count"),
        )
        # Parse publication date
        pub = data.get("publication_date")
        if pub:
            try:
                book.publication_date = date(int(str(pub)[:4]), 1, 1)
            except (ValueError, TypeError):
                pass
        db.add(book)
        await db.flush()
        await db.refresh(book)

        # Authors
        seen_authors = set()
        for author_name in (data.get("authors") or []):
            if not author_name or author_name in seen_authors:
                continue
            seen_authors.add(author_name)
            result = await db.execute(select(Author).where(Author.name == author_name))
            author = result.scalar_one_or_none()
            if not author:
                author = Author(name=author_name)
                db.add(author)
                await db.flush()
                await db.refresh(author)
            db.add(BookAuthor(book_id=book.id, author_id=author.id))

        # Genres
        seen_genres = set()
        for genre_name in (data.get("genres") or [])[:10]:
            if not genre_name or not isinstance(genre_name, str):
                continue
            # case-insensitive deduplication
            genre_lower = genre_name.lower()
            if genre_lower in seen_genres:
                continue
            seen_genres.add(genre_lower)
            
            result = await db.execute(select(Genre).where(Genre.name == genre_name))
            genre = result.scalar_one_or_none()
            if not genre:
                genre = Genre(name=genre_name)
                db.add(genre)
                await db.flush()
                await db.refresh(genre)
            db.add(BookGenre(book_id=book.id, genre_id=genre.id))

        await db.flush()

    return book
