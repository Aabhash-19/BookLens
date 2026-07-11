import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Float, Text, DateTime, JSON
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from app.core.database import Base


class BookScan(Base):
    __tablename__ = "book_scans"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    identified_book_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("books.id", ondelete="SET NULL"), nullable=True
    )
    image_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    thumbnail_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scan_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="pending"
    )  # pending / processing / identified / needs_confirmation / failed
    recognition_method: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # barcode / ocr / manual
    ocr_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detected_isbn: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    raw_candidates: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="scans")
    identified_book: Mapped[Optional["Book"]] = relationship("Book", back_populates="scans")


from app.models.user import User  # noqa: E402
from app.models.book import Book  # noqa: E402
