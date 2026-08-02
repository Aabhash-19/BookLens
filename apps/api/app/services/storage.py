"""
Object storage service using boto3 (S3-compatible).

Works with Supabase Storage, AWS S3, Cloudflare R2, or any S3-compatible service.
All I/O is done in a thread pool to avoid blocking the async event loop.
"""
import asyncio
import io
import uuid
from datetime import datetime
from typing import Optional

import boto3
from botocore.config import Config

from app.core.config import get_settings

_client = None


def _get_client():
    global _client
    if _client is None:
        settings = get_settings()
        scheme = "https" if settings.minio_secure else "http"
        endpoint_url = f"{scheme}://{settings.minio_endpoint}"
        _client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )
    return _client


async def init_storage() -> None:
    """Ensure the bucket exists (creates it if not found)."""
    settings = get_settings()
    loop = asyncio.get_event_loop()
    client = _get_client()

    def _ensure_bucket():
        try:
            client.head_bucket(Bucket=settings.minio_bucket_name)
        except Exception:
            try:
                client.create_bucket(Bucket=settings.minio_bucket_name)
            except Exception:
                pass  # Bucket may already exist or creation may not be needed

    await loop.run_in_executor(None, _ensure_bucket)


async def upload_bytes(
    data: bytes,
    object_name: str,
    content_type: str = "image/webp",
) -> str:
    """Upload raw bytes to storage. Returns the object_name (storage path)."""
    settings = get_settings()
    client = _get_client()
    loop = asyncio.get_event_loop()

    def _upload():
        client.put_object(
            Bucket=settings.minio_bucket_name,
            Key=object_name,
            Body=io.BytesIO(data),
            ContentLength=len(data),
            ContentType=content_type,
        )

    await loop.run_in_executor(None, _upload)
    return object_name


async def presigned_url(object_name: str, expires_hours: int = 1) -> str:
    """Generate a temporary signed URL for reading an object."""
    settings = get_settings()
    client = _get_client()
    loop = asyncio.get_event_loop()

    def _sign():
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.minio_bucket_name, "Key": object_name},
            ExpiresIn=expires_hours * 3600,
        )

    return await loop.run_in_executor(None, _sign)


async def delete_object(object_name: str) -> None:
    """Delete an object from storage."""
    settings = get_settings()
    client = _get_client()
    loop = asyncio.get_event_loop()

    def _delete():
        try:
            client.delete_object(Bucket=settings.minio_bucket_name, Key=object_name)
        except Exception:
            pass  # Already deleted or not found — fine

    await loop.run_in_executor(None, _delete)


async def get_bytes(object_name: str) -> bytes:
    """Download an object from storage as bytes."""
    settings = get_settings()
    client = _get_client()
    loop = asyncio.get_event_loop()

    def _download():
        response = client.get_object(Bucket=settings.minio_bucket_name, Key=object_name)
        return response["Body"].read()

    return await loop.run_in_executor(None, _download)


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
