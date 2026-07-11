"""
Pydantic schemas for books, scans, library, preferences, and recommendations.
"""
from datetime import datetime, date
from typing import Optional, List, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


# ─── Book schemas ─────────────────────────────────────────────────────────────

class AuthorResponse(BaseModel):
    id: UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class GenreResponse(BaseModel):
    id: UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class BookResponse(BaseModel):
    id: UUID
    isbn_10: Optional[str] = None
    isbn_13: Optional[str] = None
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None
    publisher: Optional[str] = None
    publication_date: Optional[date] = None
    page_count: Optional[int] = None
    cover_url: Optional[str] = None
    average_rating: Optional[float] = None
    ratings_count: Optional[int] = None
    metadata_source: Optional[str] = None
    authors: List[AuthorResponse] = []
    genres: List[GenreResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BookSearchResult(BaseModel):
    id: Optional[UUID] = None
    title: str
    authors: List[str] = []
    cover_url: Optional[str] = None
    average_rating: Optional[float] = None
    isbn_13: Optional[str] = None
    isbn_10: Optional[str] = None
    description: Optional[str] = None
    publisher: Optional[str] = None
    metadata_source: Optional[str] = None


# ─── Scan schemas ─────────────────────────────────────────────────────────────

class ScanCandidateResponse(BaseModel):
    title: str
    authors: List[str] = []
    cover_url: Optional[str] = None
    isbn_13: Optional[str] = None
    isbn_10: Optional[str] = None
    confidence: float
    metadata_source: Optional[str] = None


class ScanResponse(BaseModel):
    scan_id: UUID
    status: str  # pending | processing | identified | needs_confirmation | failed
    recognition_method: Optional[str] = None
    identified_book_id: Optional[UUID] = None
    detected_isbn: Optional[str] = None
    ocr_text: Optional[str] = None
    candidates: List[Any] = []
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ScanConfirmRequest(BaseModel):
    """User picks which book was scanned."""
    book_id: Optional[UUID] = None          # pick from DB by ID
    book_data: Optional[dict] = None        # or pass raw metadata (for external results)


# ─── Library schemas ──────────────────────────────────────────────────────────

class LibraryAddRequest(BaseModel):
    interaction_type: str
    rating: Optional[float] = Field(None, ge=1.0, le=5.0)
    notes: Optional[str] = None


class LibraryUpdateRequest(BaseModel):
    interaction_type: Optional[str] = None
    rating: Optional[float] = Field(None, ge=1.0, le=5.0)
    notes: Optional[str] = None


class LibraryEntryResponse(BaseModel):
    id: UUID
    book_id: UUID
    interaction_type: str
    rating: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    book: Optional[BookResponse] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Preferences schemas ──────────────────────────────────────────────────────

class UserPreferenceCreate(BaseModel):
    preference_type: str
    preference_value: str
    weight: float = 1.0


class UserPreferenceBulk(BaseModel):
    preferences: List[UserPreferenceCreate]


class UserPreferenceResponse(BaseModel):
    id: UUID
    preference_type: str
    preference_value: str
    weight: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Recommendation schemas ───────────────────────────────────────────────────

class RecommendationResponse(BaseModel):
    id: UUID
    book: Optional[BookResponse] = None
    score: float
    reason: Optional[str] = None
    shown_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecommendationFeedback(BaseModel):
    action: str  # clicked | dismissed | not_interested
