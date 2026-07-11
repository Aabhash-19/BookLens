"""
BookLens API — main application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.core.database import create_tables
from app.services.storage import init_storage
from app.api.v1.router import api_router

settings = get_settings()

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create DB tables and MinIO bucket. Shutdown: cleanup."""
    await create_tables()
    await init_storage()
    yield


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="BookLens API",
    description="Intelligent book-discovery API: scan, identify, and get personalised recommendations.",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health_check():
    """Quick liveness probe."""
    return {"status": "ok", "version": "1.0.0"}
