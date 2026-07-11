import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Boolean, Float, Text, Integer, DateTime, Date, Index
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from pgvector.sqlalchemy import Vector
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    preferences: Mapped[list["UserPreference"]] = relationship("UserPreference", back_populates="user", cascade="all, delete-orphan")
    embedding: Mapped[Optional["UserEmbedding"]] = relationship("UserEmbedding", back_populates="user", uselist=False, cascade="all, delete-orphan")
    interactions: Mapped[list["UserBookInteraction"]] = relationship("UserBookInteraction", back_populates="user", cascade="all, delete-orphan")
    scans: Mapped[list["BookScan"]] = relationship("BookScan", back_populates="user", cascade="all, delete-orphan")
    recommendations: Mapped[list["Recommendation"]] = relationship("Recommendation", back_populates="user", cascade="all, delete-orphan")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    preference_type: Mapped[str] = mapped_column(String(50), nullable=False)  # genre, author, language, reading_type
    preference_value: Mapped[str] = mapped_column(String(255), nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="preferences")


class UserEmbedding(Base):
    __tablename__ = "user_embeddings"

    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    preference_embedding: Mapped[Optional[list]] = mapped_column(Vector(384), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="embedding")


# Deferred imports to avoid circular imports
from app.models.scan import BookScan  # noqa: E402
from app.models.interaction import UserBookInteraction  # noqa: E402
from app.models.recommendation import Recommendation  # noqa: E402
