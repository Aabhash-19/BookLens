from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.book import BookResponse


class LibraryBookRequest(BaseModel):
    interaction_type: str  # want_to_read / reading / finished / liked / disliked / favourited
    rating: Optional[float] = None
    notes: Optional[str] = None


class LibraryBookResponse(BaseModel):
    book: BookResponse
    interaction_type: str
    rating: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
