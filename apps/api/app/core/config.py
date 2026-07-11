from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://booklens:booklens_secret@localhost:5432/booklens"
    database_url_sync: str = "postgresql://booklens:booklens_secret@localhost:5432/booklens"
    redis_url: str = "redis://localhost:6379/0"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin_secret"
    minio_bucket_name: str = "book-scans"
    minio_secure: bool = False
    secret_key: str = "your-super-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 43200
    open_library_base_url: str = "https://openlibrary.org"
    google_books_api_key: str = ""
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
