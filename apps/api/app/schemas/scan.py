from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.schemas.book import BookResponse


class ScanCandidate(BaseModel):
    book_id: str
    title: str
    authors: List[str] = []
    cover_url: Optional[str] = None
    confidence: float
    isbn_13: Optional[str] = None
    isbn_10: Optional[str] = None


class ScanResponse(BaseModel):
    id: UUID
    scan_status: str
    recognition_method: Optional[str] = None
    confidence_score: Optional[float] = None
    candidates: List[ScanCandidate] = []
    identified_book: Optional[BookResponse] = None
    image_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScanConfirm(BaseModel):
    book_id: str
