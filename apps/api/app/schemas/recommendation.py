from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.schemas.book import BookResponse


class RecommendationResponse(BaseModel):
    id: UUID
    book: BookResponse
    score: float
    reason: str
    shown_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RecommendationFeedback(BaseModel):
    action: str  # clicked / dismissed / not_interested / saved


class RecommendationsListResponse(BaseModel):
    recommendations: List[RecommendationResponse]
    total: int
