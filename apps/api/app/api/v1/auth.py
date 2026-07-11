"""
Authentication & user profile routes.

POST /auth/register
POST /auth/login
POST /auth/logout   (client-side token discard; here for API completeness)
GET  /users/me
PUT  /users/me
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, File, UploadFile
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, UserResponse, Token, AuthResponse
from app.services import image_processing as ip, storage

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new account and return a JWT token."""
    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        email=payload.email,
        display_name=payload.display_name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return AuthResponse(
        user=UserResponse.model_validate(user),
        token=Token(access_token=token),
    )


@router.post("/login", response_model=AuthResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login with email + password."""
    email = payload.email
    password = payload.password

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive.")

    token = create_access_token({"sub": str(user.id)})
    return AuthResponse(
        user=UserResponse.model_validate(user),
        token=Token(access_token=token),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout():
    """Client should discard the token. Server is stateless (JWT)."""
    return None


# ── User profile ──────────────────────────────────────────────────────────────

@router.get("/users/me", response_model=UserResponse, tags=["Profile"])
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return current_user


@router.put("/users/me", response_model=UserResponse, tags=["Profile"])
async def update_me(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update display_name and/or avatar_url."""
    allowed = {"display_name", "avatar_url"}
    for key, value in payload.items():
        if key in allowed:
            setattr(current_user, key, value)
    await db.flush()
    await db.refresh(current_user)
    return current_user


@router.post("/users/me/avatar", response_model=UserResponse, tags=["Profile"])
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload and process a profile picture."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Unsupported file type.")
    
    raw_bytes = await file.read()
    if len(raw_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 5MB).")
        
    try:
        # Resize to 256x256 max and convert to webp using PIL
        import io
        from PIL import Image
        img = Image.open(io.BytesIO(raw_bytes))
        img.thumbnail((256, 256))
        
        out_bytes = io.BytesIO()
        img.save(out_bytes, format="WEBP")
        webp_bytes = out_bytes.getvalue()
        
        path = storage.build_avatar_path(str(current_user.id))
        await storage.upload_bytes(webp_bytes, path)
        
        # Store the actual minio path in the database
        current_user.avatar_url = path
        
        await db.flush()
        await db.refresh(current_user)
        return current_user
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/avatar_image", tags=["Profile"])
async def get_avatar_image(user_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch the signed MinIO URL for the avatar and proxy it."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.avatar_url or not user.avatar_url.startswith("avatars/"):
        raise HTTPException(status_code=404, detail="Avatar not found")
        
    try:
        img_bytes = await storage.get_bytes(user.avatar_url)
        return Response(content=img_bytes, media_type="image/webp")
    except Exception:
        raise HTTPException(status_code=404, detail="Avatar image not found in storage")
