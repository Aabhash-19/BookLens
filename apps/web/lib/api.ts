/**
 * API service layer — typed fetch wrapper.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const json = await res.json();
      detail = json.detail || detail;
    } catch {}
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
