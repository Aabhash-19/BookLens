from typing import Optional, List
from pydantic import BaseModel


class PreferenceItem(BaseModel):
    preference_type: str  # genre / author / language / reading_type
    preference_value: str
    weight: float = 1.0


class PreferencesResponse(BaseModel):
    items: List[PreferenceItem]


class PreferencesUpdate(BaseModel):
    items: List[PreferenceItem]


class OnboardingData(BaseModel):
    genres: List[str] = []
    authors: List[str] = []
    languages: List[str] = []
    reading_types: List[str] = []
