/**
 * API service layer — typed fetch wrapper.
 */

const FALLBACK_PROD_API = "https://booklets-api.onrender.com";
const FALLBACK_DEV_API = "http://localhost:8000";

export function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (
    envUrl &&
    typeof envUrl === "string" &&
    envUrl.trim() !== "" &&
    envUrl !== "NEXT_PUBLIC_API_URL" &&
    !envUrl.includes("${") &&
    (envUrl.startsWith("http://") || envUrl.startsWith("https://"))
  ) {
    return envUrl.replace(/\/+$/, "");
  }

  // In browser, if on production domain
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return FALLBACK_PROD_API;
  }

  // During production build
  if (process.env.NODE_ENV === "production") {
    return FALLBACK_PROD_API;
  }

  return FALLBACK_DEV_API;
}

export const API_BASE = getApiBase();

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TIMEOUT_MS = 45_000; // 45 s — accommodates Render cold-start and external book discovery

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const base = getApiBase();
  const fullUrl = path.startsWith("http") ? path : `${base}${path}`;

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(
        "The server is taking too long to respond. Render may be waking up — please try again in a moment.",
        408
      );
    }
    throw new ApiError(
      err instanceof Error && err.message
        ? err.message
        : "Network error. Please check your connection.",
      0
    );
  }
  clearTimeout(timer);

  if (!res.ok) {
    let detail = "";
    try {
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const json = await res.json();
        detail = json.detail || json.message || "";
      } else {
        const text = await res.text();
        if (!text.trim().startsWith("<")) {
          detail = text.slice(0, 150);
        }
      }
    } catch {}

    if (!detail || detail.trim() === "") {
      if (res.status === 401) {
        detail = "Incorrect email or password.";
      } else if (res.status === 404) {
        detail = "Resource not found.";
      } else if (res.status === 403) {
        detail = "Access denied.";
      } else if (res.status >= 500) {
        detail = "Server error. Please try again later.";
      } else {
        detail = `Request failed (${res.status})`;
      }
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  user: User;
  token: { access_token: string; token_type: string };
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
}

export async function register(
  email: string,
  password: string,
  display_name: string
): Promise<AuthResponse> {
  return request("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, display_name }),
  });
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  return request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(token: string): Promise<User> {
  return request("/api/v1/auth/users/me", {}, token);
}

// ── Books ─────────────────────────────────────────────────────────────────────

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  cover_url?: string;
  isbn_13?: string;
  isbn_10?: string;
  authors: { id: string; name: string }[];
  genres: { id: string; name: string }[];
  publisher?: string;
  publication_date?: string;
  page_count?: number;
  average_rating?: number;
  ratings_count?: number;
  language?: string;
  created_at: string;
}

export interface BookSearchResult {
  id?: string;
  title: string;
  authors: string[];
  cover_url?: string;
  isbn_13?: string;
  isbn_10?: string;
  description?: string;
  publisher?: string;
  metadata_source?: string;
  average_rating?: number;
}

export async function searchBooks(q: string, token?: string): Promise<BookSearchResult[]> {
  return request(`/api/v1/books/search?q=${encodeURIComponent(q)}&limit=10`, {}, token);
}

export async function getBook(id: string, token?: string): Promise<Book> {
  return request(`/api/v1/books/${id}`, {}, token);
}

export async function getSimilarBooks(id: string, token?: string): Promise<Book[]> {
  return request(`/api/v1/books/${id}/similar`, {}, token);
}

export async function getBookByIsbn(isbn: string, token?: string): Promise<BookSearchResult> {
  return request(`/api/v1/books/isbn/${isbn}`, {}, token);
}

// ── Scans ──────────────────────────────────────────────────────────────────

export interface ScanCandidate {
  title: string;
  authors: string[];
  cover_url?: string;
  isbn_13?: string;
  isbn_10?: string;
  confidence: number;
  metadata_source?: string;
}

export interface ScanResponse {
  scan_id: string;
  status: "pending" | "processing" | "identified" | "needs_confirmation" | "failed";
  recognition_method?: string;
  identified_book_id?: string;
  detected_isbn?: string;
  ocr_text?: string;
  candidates: ScanCandidate[];
  created_at?: string;
}

export async function uploadScan(file: File, token: string): Promise<ScanResponse> {
  const form = new FormData();
  form.append("file", file);
  return request("/api/v1/scans", { method: "POST", body: form }, token);
}

export async function getScans(token: string): Promise<ScanResponse[]> {
  return request("/api/v1/scans", {}, token);
}

export async function confirmScan(
  scanId: string,
  payload: { book_id?: string; book_data?: Record<string, unknown> },
  token: string
): Promise<ScanResponse> {
  return request(`/api/v1/scans/${scanId}/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function deleteScan(scanId: string, token: string): Promise<void> {
  return request(`/api/v1/scans/${scanId}`, { method: "DELETE" }, token);
}

// ── Library ────────────────────────────────────────────────────────────────

export interface LibraryEntry {
  id: string;
  book_id: string;
  interaction_type: string;
  rating?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  book?: Book;
}

export async function getLibrary(token: string, interaction_type?: string): Promise<LibraryEntry[]> {
  const q = interaction_type ? `?interaction_type=${interaction_type}` : "";
  return request(`/api/v1/library${q}`, {}, token);
}

export async function addToLibrary(
  bookId: string,
  payload: { interaction_type: string; rating?: number; notes?: string },
  token: string
): Promise<LibraryEntry> {
  return request(`/api/v1/library/${bookId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export async function updateLibraryEntry(
  bookId: string,
  payload: { interaction_type?: string; rating?: number; notes?: string },
  token: string
): Promise<LibraryEntry> {
  return request(`/api/v1/library/${bookId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }, token);
}

export async function removeFromLibrary(bookId: string, token: string): Promise<void> {
  return request(`/api/v1/library/${bookId}`, { method: "DELETE" }, token);
}

// ── Preferences ────────────────────────────────────────────────────────────

export interface Preference {
  id: string;
  preference_type: string;
  preference_value: string;
  weight: number;
  created_at: string;
  updated_at: string;
}

export async function getPreferences(token: string): Promise<Preference[]> {
  return request("/api/v1/preferences", {}, token);
}

export async function setPreferences(
  preferences: { preference_type: string; preference_value: string; weight: number }[],
  token: string
): Promise<Preference[]> {
  return request("/api/v1/preferences", {
    method: "PUT",
    body: JSON.stringify({ preferences }),
  }, token);
}

// ── Recommendations ────────────────────────────────────────────────────────

export interface Recommendation {
  id: string;
  book: Book;
  score: number;
  reason?: string;
  shown_at?: string;
  created_at: string;
}

export async function getRecommendations(
  token: string, 
  refresh?: boolean,
  filters?: { author?: string; genre?: string; language?: string; title?: string }
): Promise<Recommendation[]> {
  const params = new URLSearchParams();
  if (refresh) params.append("refresh", "true");
  if (filters?.author) params.append("author", filters.author);
  if (filters?.genre) params.append("genre", filters.genre);
  if (filters?.language) params.append("language", filters.language);
  if (filters?.title) params.append("title", filters.title);
  
  const q = params.toString() ? `?${params.toString()}` : "";
  return request(`/api/v1/recommendations${q}`, {}, token);
}

export async function sendRecommendationFeedback(
  recId: string,
  action: "clicked" | "dismissed" | "not_interested",
  token: string
): Promise<void> {
  return request(`/api/v1/recommendations/${recId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ action }),
  }, token);
}

export async function getFilterSuggestions(
  token: string,
  query: string,
  type: "author" | "genre" | "language" | "book"
): Promise<string[]> {
  const q = new URLSearchParams({ q: query, type });
  return request(`/api/v1/recommendations/suggest?${q.toString()}`, {}, token);
}

export { ApiError };
