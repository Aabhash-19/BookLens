"""
MinIO / object-storage service.

Wraps the minio client with async-friendly helpers.
All I/O is done in a thread pool to avoid blocking the event loop.
"""
import asyncio
import io
import uuid
from datetime import datetime, timedelta
from functools import partial
from typing import Optional

from minio import Minio
from minio.error import S3Error

from app.core.config import get_settings

_client: Optional[Minio] = None


def _get_client() -> Minio:
    global _client
    if _client is None:
        settings = get_settings()
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
    return _client


async def init_storage() -> None:
    """Create the bucket if it does not already exist."""
    settings = get_settings()
    loop = asyncio.get_event_loop()
    client = _get_client()

    def _ensure_bucket():
        if not client.bucket_exists(settings.minio_bucket_name):
            client.make_bucket(settings.minio_bucket_name)

    await loop.run_in_executor(None, _ensure_bucket)


async def upload_bytes(
    data: bytes,
    object_name: str,
    content_type: str = "image/webp",
) -> str:
    """Upload raw bytes to MinIO. Returns the object_name (storage path)."""
    settings = get_settings()
    client = _get_client()
    loop = asyncio.get_event_loop()

    def _upload():
        client.put_object(
            settings.minio_bucket_name,
            object_name,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )

    await loop.run_in_executor(None, _upload)
    return object_name


async def presigned_url(object_name: str, expires_hours: int = 1) -> str:
    """Generate a temporary signed URL for reading an object."""
    settings = get_settings()
    client = _get_client()
    loop = asyncio.get_event_loop()

    def _sign():
        return client.presigned_get_object(
            settings.minio_bucket_name,
            object_name,
            expires=timedelta(hours=expires_hours),
        )

    return await loop.run_in_executor(None, _sign)


async def delete_object(object_name: str) -> None:
    """Delete an object from storage."""
    settings = get_settings()
    client = _get_client()
    loop = asyncio.get_event_loop()

    def _delete():
        try:
            client.remove_object(settings.minio_bucket_name, object_name)
        except S3Error:
            pass  # already deleted or not found — fine

    await loop.run_in_executor(None, _delete)


def build_scan_path(user_id: str, suffix: str = "") -> str:
    """Deterministic path template: book-scans/user-id/YYYY/MM/uuid[-suffix].webp"""
    now = datetime.utcnow()
    uid = uuid.uuid4()
    name = f"{uid}{suffix}.webp"
    return f"book-scans/{user_id}/{now.year}/{now.month:02d}/{name}"


def build_avatar_path(user_id: str) -> str:
    """Deterministic path template: avatars/user-id/uuid.webp"""
    uid = uuid.uuid4()
    return f"avatars/{user_id}/{uid}.webp"


async def get_bytes(object_name: str) -> bytes:
    """Download an object from MinIO as bytes."""
    settings = get_settings()
    client = _get_client()
    loop = asyncio.get_event_loop()

    def _download():
        response = None
        try:
            response = client.get_object(settings.minio_bucket_name, object_name)
            return response.read()
        finally:
            if response:
                response.close()
                response.release_conn()

    return await loop.run_in_executor(None, _download)

