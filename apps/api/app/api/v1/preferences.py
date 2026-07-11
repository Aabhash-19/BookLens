"""
Preferences routes.

GET  /preferences
PUT  /preferences        ← bulk replace (onboarding)
POST /preferences        ← add single preference
DELETE /preferences/{id}
"""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserPreference
from app.schemas.book import UserPreferenceResponse, UserPreferenceCreate, UserPreferenceBulk
from app.services.recommendation import update_user_embedding

router = APIRouter()

VALID_PREFERENCE_TYPES = {"genre", "author", "language", "reading_type", "topic"}


@router.get("", response_model=List[UserPreferenceResponse])
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all preferences for the current user."""
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
        .order_by(UserPreference.preference_type, UserPreference.weight.desc())
    )
    return result.scalars().all()


@router.put("", response_model=List[UserPreferenceResponse])
async def replace_preferences(
    payload: UserPreferenceBulk,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Replace ALL preferences for the user (used during onboarding).
    Deletes existing ones and inserts new ones.
    """
    await db.execute(
        delete(UserPreference).where(UserPreference.user_id == current_user.id)
    )

    new_prefs = []
    for item in payload.preferences:
        if item.preference_type not in VALID_PREFERENCE_TYPES:
            continue
        pref = UserPreference(
            user_id=current_user.id,
            preference_type=item.preference_type,
            preference_value=item.preference_value,
            weight=item.weight,
        )
        db.add(pref)
        new_prefs.append(pref)

    await db.flush()
    for p in new_prefs:
        await db.refresh(p)
    
    # Update the user embedding so explicitly set preferences influence recommendations
    await update_user_embedding(db, current_user.id)
    
    return new_prefs


@router.post("", response_model=UserPreferenceResponse, status_code=status.HTTP_201_CREATED)
async def add_preference(
    payload: UserPreferenceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a single preference."""
    if payload.preference_type not in VALID_PREFERENCE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid preference_type. Must be one of: {', '.join(sorted(VALID_PREFERENCE_TYPES))}",
        )
    pref = UserPreference(
        user_id=current_user.id,
        preference_type=payload.preference_type,
        preference_value=payload.preference_value,
        weight=payload.weight,
    )
    db.add(pref)
    await db.flush()
    await db.refresh(pref)
    
    await update_user_embedding(db, current_user.id)
    
    return pref


@router.delete("/{preference_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_preference(
    preference_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a specific preference."""
    result = await db.execute(
        select(UserPreference).where(
            UserPreference.id == preference_id,
            UserPreference.user_id == current_user.id,
        )
    )
    pref = result.scalar_one_or_none()
    if not pref:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preference not found.")
    await db.delete(pref)
