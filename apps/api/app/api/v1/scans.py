"""
Scan routes.

POST   /scans              ← upload image, run pipeline
GET    /scans              ← scan history
GET    /scans/{id}         ← scan detail
POST   /scans/{id}/confirm ← user picks which book
DELETE /scans/{id}
"""
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.scan import BookScan
from app.schemas.book import ScanResponse, ScanConfirmRequest
from app.services import scan_processor, storage

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 8 * 1024 * 1024  # 8 MB


@router.post("", response_model=ScanResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_scan(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a book image and run the identification pipeline."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG, PNG, or WebP.",
        )

    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 8 MB limit.",
        )

    result = await scan_processor.process_scan(db, current_user.id, raw_bytes)
    return _result_to_response(result)


@router.get("", response_model=List[ScanResponse])
async def list_scans(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return paginated scan history for the current user."""
    result = await db.execute(
        select(BookScan)
        .where(BookScan.user_id == current_user.id)
        .order_by(BookScan.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    scans = result.scalars().all()
    return [_scan_to_response(s) for s in scans]


@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan(
    scan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific scan with its candidates."""
    result = await db.execute(
        select(BookScan).where(BookScan.id == scan_id, BookScan.user_id == current_user.id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found.")
    return _scan_to_response(scan)


@router.post("/{scan_id}/confirm", response_model=ScanResponse)
async def confirm_scan(
    scan_id: uuid.UUID,
    payload: ScanConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User picks which book was scanned (from candidates or manual entry)."""
    result = await db.execute(
        select(BookScan).where(BookScan.id == scan_id, BookScan.user_id == current_user.id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found.")

    if payload.book_data:
        await scan_processor.confirm_scan(db, scan, payload.book_data)
    elif payload.book_id:
        scan.identified_book_id = payload.book_id
        scan.scan_status = "identified"
        scan.recognition_method = "user_confirmation"
        await db.flush()

    return _scan_to_response(scan)


@router.delete("/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scan(
    scan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a scan record and its stored images."""
    result = await db.execute(
        select(BookScan).where(BookScan.id == scan_id, BookScan.user_id == current_user.id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found.")

    if scan.image_path:
        await storage.delete_object(scan.image_path)
    if scan.thumbnail_path:
        await storage.delete_object(scan.thumbnail_path)

    await db.delete(scan)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _result_to_response(result) -> ScanResponse:
    return ScanResponse(
        scan_id=result.scan_id,
        status=result.status,
        recognition_method=result.recognition_method,
        identified_book_id=result.identified_book_id,
        detected_isbn=result.detected_isbn,
        ocr_text=result.ocr_text,
        candidates=[
            {
                "title": c.title,
                "authors": c.authors,
                "cover_url": c.cover_url,
                "isbn_13": c.isbn_13,
                "isbn_10": c.isbn_10,
                "confidence": c.confidence,
                "metadata_source": c.metadata_source,
            }
            for c in result.candidates
        ],
    )


def _scan_to_response(scan: BookScan) -> ScanResponse:
    return ScanResponse(
        scan_id=scan.id,
        status=scan.scan_status,
        recognition_method=scan.recognition_method,
        identified_book_id=scan.identified_book_id,
        detected_isbn=scan.detected_isbn,
        ocr_text=scan.ocr_text,
        candidates=scan.raw_candidates or [],
        created_at=scan.created_at,
    )
