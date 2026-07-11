"""
Library routes — user's personal reading list.

GET    /library                  ← list interactions (optionally filtered by status)
POST   /library/{book_id}        ← add or update interaction
PATCH  /library/{book_id}        ← update rating / notes
DELETE /library/{book_id}        ← remove from library
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.book import Book
from app.models.interaction import UserBookInteraction
from app.schemas.book import LibraryEntryResponse, LibraryAddRequest, LibraryUpdateRequest
from app.services.recommendation import update_user_embedding, upsert_book_embedding

router = APIRouter()

VALID_STATUSES = {
    "want_to_read", "reading", "finished", "liked", "disliked",
    "favourited", "not_interested", "scanned",
}


@router.get("", response_model=List[LibraryEntryResponse])
async def get_library(
    interaction_type: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the user's reading library, optionally filtered by status."""
    q = (
        select(UserBookInteraction)
        .where(UserBookInteraction.user_id == current_user.id)
        .options(selectinload(UserBookInteraction.book).selectinload(Book.authors))
        .options(selectinload(UserBookInteraction.book).selectinload(Book.genres))
        .order_by(UserBookInteraction.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if interaction_type:
        q = q.where(UserBookInteraction.interaction_type == interaction_type)
    result = await db.execute(q)
    interactions = result.scalars().all()
    return [_interaction_to_response(i) for i in interactions]


@router.post("/{book_id}", response_model=LibraryEntryResponse, status_code=status.HTTP_201_CREATED)
async def add_to_library(
    book_id: uuid.UUID,
    payload: LibraryAddRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a book to the user's library or update if it already exists."""
    if payload.interaction_type not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid interaction_type. Must be one of: {', '.join(sorted(VALID_STATUSES))}",
        )

    # Verify the book exists
    book_result = await db.execute(
        select(Book).where(Book.id == book_id).options(selectinload(Book.authors), selectinload(Book.genres), selectinload(Book.embedding))
    )
    book = book_result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")

    # Upsert interaction
    existing = await db.execute(
        select(UserBookInteraction).where(
            UserBookInteraction.user_id == current_user.id,
            UserBookInteraction.book_id == book_id,
        )
    )
    interaction = existing.scalar_one_or_none()

    if interaction:
        interaction.interaction_type = payload.interaction_type
        if payload.rating is not None:
            interaction.rating = payload.rating
        if payload.notes is not None:
            interaction.notes = payload.notes
    else:
        interaction = UserBookInteraction(
            user_id=current_user.id,
            book_id=book_id,
            interaction_type=payload.interaction_type,
            rating=payload.rating,
            notes=payload.notes,
        )
        db.add(interaction)

    await db.flush()
    await db.refresh(interaction)

    # Ensure book has an embedding and update user's preference vector
    if not book.embedding:
        await upsert_book_embedding(db, book)
    await update_user_embedding(db, current_user.id)

    return _interaction_to_response(interaction)


@router.patch("/{book_id}", response_model=LibraryEntryResponse)
async def update_library_entry(
    book_id: uuid.UUID,
    payload: LibraryUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update rating or notes for an existing library entry."""
    result = await db.execute(
        select(UserBookInteraction).where(
            UserBookInteraction.user_id == current_user.id,
            UserBookInteraction.book_id == book_id,
        )
    )
    interaction = result.scalar_one_or_none()
    if not interaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not in your library.")

    if payload.interaction_type is not None:
        interaction.interaction_type = payload.interaction_type
    if payload.rating is not None:
        interaction.rating = payload.rating
    if payload.notes is not None:
        interaction.notes = payload.notes

    await db.flush()
    await db.refresh(interaction)
    await update_user_embedding(db, current_user.id)
    return _interaction_to_response(interaction)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_library(
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a book from the user's library."""
    result = await db.execute(
        select(UserBookInteraction).where(
            UserBookInteraction.user_id == current_user.id,
            UserBookInteraction.book_id == book_id,
        )
    )
    interaction = result.scalar_one_or_none()
    if not interaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not in your library.")
    await db.delete(interaction)


# ── Helper ────────────────────────────────────────────────────────────────────

def _interaction_to_response(i: UserBookInteraction) -> LibraryEntryResponse:
    book = i.book
    return LibraryEntryResponse(
        id=i.id,
        book_id=i.book_id,
        interaction_type=i.interaction_type,
        rating=i.rating,
        notes=i.notes,
        created_at=i.created_at,
        updated_at=i.updated_at,
        book=book,
    )
