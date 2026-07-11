import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Float, Text, Integer, DateTime, Date, Index
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from pgvector.sqlalchemy import Vector
from app.core.database import Base


class Book(Base):
    __tablename__ = "books"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    isbn_10: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    isbn_13: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    subtitle: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    publisher: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    publication_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    page_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cover_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    open_library_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    google_books_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    average_rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ratings_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=0)
    metadata_source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="open_library")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    book_authors: Mapped[list["BookAuthor"]] = relationship("BookAuthor", back_populates="book", cascade="all, delete-orphan")
    authors: Mapped[list["Author"]] = relationship("Author", secondary="book_authors", back_populates="books", viewonly=True)
    book_genres: Mapped[list["BookGenre"]] = relationship("BookGenre", back_populates="book", cascade="all, delete-orphan")
    genres: Mapped[list["Genre"]] = relationship("Genre", secondary="book_genres", back_populates="books", viewonly=True)
    embedding: Mapped[Optional["BookEmbedding"]] = relationship("BookEmbedding", back_populates="book", uselist=False, cascade="all, delete-orphan")
    interactions: Mapped[list["UserBookInteraction"]] = relationship("UserBookInteraction", back_populates="book")
    scans: Mapped[list["BookScan"]] = relationship("BookScan", back_populates="identified_book")
    recommendations: Mapped[list["Recommendation"]] = relationship("Recommendation", back_populates="book")


class Author(Base):
    __tablename__ = "authors"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    biography: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    book_authors: Mapped[list["BookAuthor"]] = relationship("BookAuthor", back_populates="author")
    books: Mapped[list["Book"]] = relationship("Book", secondary="book_authors", back_populates="authors", viewonly=True)


class BookAuthor(Base):
    __tablename__ = "book_authors"

    book_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), primary_key=True)
    author_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("authors.id", ondelete="CASCADE"), primary_key=True)

    # Relationships
    book: Mapped["Book"] = relationship("Book", back_populates="book_authors")
    author: Mapped["Author"] = relationship("Author", back_populates="book_authors")


class Genre(Base):
    __tablename__ = "genres"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)

    # Relationships
    book_genres: Mapped[list["BookGenre"]] = relationship("BookGenre", back_populates="genre")
    books: Mapped[list["Book"]] = relationship("Book", secondary="book_genres", back_populates="genres", viewonly=True)


class BookGenre(Base):
    __tablename__ = "book_genres"

    book_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), primary_key=True)
    genre_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    # Relationships
    book: Mapped["Book"] = relationship("Book", back_populates="book_genres")
    genre: Mapped["Genre"] = relationship("Genre", back_populates="book_genres")


class BookEmbedding(Base):
    __tablename__ = "book_embeddings"

    book_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), primary_key=True)
    text_embedding: Mapped[Optional[list]] = mapped_column(Vector(384), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    book: Mapped["Book"] = relationship("Book", back_populates="embedding")


# Deferred imports to avoid circular dependency issues
from app.models.interaction import UserBookInteraction  # noqa: E402
from app.models.scan import BookScan  # noqa: E402
from app.models.recommendation import Recommendation  # noqa: E402
