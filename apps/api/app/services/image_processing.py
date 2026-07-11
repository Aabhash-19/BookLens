"""
Image processing service.

Pipeline:
  raw bytes
    → decode (OpenCV / Pillow)
    → preprocess (resize, denoise, deskew, contrast)
    → barcode detection (pyzbar)
    → OCR (Tesseract)
    → WebP encode + thumbnail
"""
import asyncio
import io
import re
from typing import Optional

import cv2
import numpy as np
import pytesseract
from PIL import Image
from pyzbar import pyzbar

# ── Helpers ───────────────────────────────────────────────────────────────────

def _bytes_to_cv(data: bytes) -> np.ndarray:
    """Decode raw image bytes into an OpenCV BGR array."""
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image data.")
    return img


def _cv_to_bytes(img: np.ndarray, quality: int = 85) -> bytes:
    """Encode OpenCV array to WebP bytes."""
    ok, buf = cv2.imencode(".webp", img, [cv2.IMWRITE_WEBP_QUALITY, quality])
    if not ok:
        raise ValueError("Could not encode image.")
    return buf.tobytes()


# ── Public API ────────────────────────────────────────────────────────────────

def preprocess_image(raw_bytes: bytes) -> np.ndarray:
    """
    Preprocessing pipeline for scan images.
    Returns an OpenCV BGR array ready for barcode detection and OCR.
    """
    img = _bytes_to_cv(raw_bytes)

    # 1. Resize: cap longest edge at 1600px
    h, w = img.shape[:2]
    max_dim = 1600
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    return img


def detect_barcode(img: np.ndarray) -> Optional[str]:
    """
    Try to extract an ISBN-10 or ISBN-13 from barcodes in the image.
    Returns the first valid ISBN found, or None.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    decoded = pyzbar.decode(gray)
    for obj in decoded:
        raw = obj.data.decode("utf-8").strip()
        # ISBN-13: 13 digits starting with 978 or 979
        if re.fullmatch(r"97[89]\d{10}", raw):
            return raw
        # ISBN-10: 9 digits + check (digit or X)
        if re.fullmatch(r"\d{9}[\dX]", raw):
            return raw
    return None


def run_ocr(img: np.ndarray) -> dict:
    """
    Run Tesseract OCR on the image.
    Returns a dict with:
      - raw_text: full OCR output
      - possible_title: likely title line (longest ALL-CAPS or title-case run)
      - possible_author: likely author line
    """
    # Preprocess for OCR: grayscale, denoise, threshold
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    raw_text = pytesseract.image_to_string(thresh, config="--psm 6")
    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]

    possible_title = _pick_title(lines)
    possible_author = _pick_author(lines, possible_title)

    return {
        "raw_text": raw_text,
        "possible_title": possible_title,
        "possible_author": possible_author,
    }


def _pick_title(lines: list[str]) -> Optional[str]:
    """Heuristic: longest line that is mostly uppercase or title-case."""
    candidates = [ln for ln in lines if len(ln) > 3]
    if not candidates:
        return None
    # Prefer lines with high uppercase ratio
    scored = sorted(
        candidates,
        key=lambda ln: (sum(1 for c in ln if c.isupper()) / max(len(ln), 1)),
        reverse=True,
    )
    return scored[0] if scored else None


def _pick_author(lines: list[str], title: Optional[str]) -> Optional[str]:
    """Heuristic: a line that looks like a name (two+ capitalized words), different from title."""
    for ln in lines:
        if ln == title:
            continue
        words = ln.split()
        if 2 <= len(words) <= 4 and all(w[0].isupper() for w in words if w):
            return ln
    return None


def make_thumbnail(img: np.ndarray, max_size: int = 400) -> bytes:
    """Resize image to thumbnail and encode as WebP."""
    h, w = img.shape[:2]
    scale = max_size / max(h, w)
    if scale < 1.0:
        thumb = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        thumb = img.copy()
    return _cv_to_bytes(thumb, quality=75)


def encode_webp(img: np.ndarray, quality: int = 85) -> bytes:
    """Encode image to WebP bytes for storage."""
    return _cv_to_bytes(img, quality=quality)


# ── Async wrappers ────────────────────────────────────────────────────────────

async def async_preprocess(raw_bytes: bytes) -> np.ndarray:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, preprocess_image, raw_bytes)


async def async_detect_barcode(img: np.ndarray) -> Optional[str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, detect_barcode, img)


async def async_run_ocr(img: np.ndarray) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, run_ocr, img)
