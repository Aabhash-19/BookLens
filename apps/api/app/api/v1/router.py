"""
API v1 router — aggregates all sub-routers.
"""
from fastapi import APIRouter

from app.api.v1 import auth, books, scans, library, preferences, recommendations

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(books.router, prefix="/books", tags=["Books"])
api_router.include_router(scans.router, prefix="/scans", tags=["Scans"])
api_router.include_router(library.router, prefix="/library", tags=["Library"])
api_router.include_router(preferences.router, prefix="/preferences", tags=["Preferences"])
api_router.include_router(recommendations.router, prefix="/recommendations", tags=["Recommendations"])
