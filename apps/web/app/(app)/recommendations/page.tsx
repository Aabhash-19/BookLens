"use client";

import { useState, useEffect } from "react";
import { Sparkles, ThumbsDown, Heart, RefreshCw, Loader2, BookOpen, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import * as api from "@/lib/api";
import clsx from "clsx";

export default function RecommendationsPage() {
  const router = useRouter();
  const { token, user, loading: authLoading } = useAuth();
  const [recs, setRecs] = useState<api.Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [libraryMap, setLibraryMap] = useState<Record<string, string>>({});

  // Filters
  const [filterAuthor, setFilterAuthor] = useState("");
  const [filterGenre, setFilterGenre] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterTitle, setFilterTitle] = useState("");

  // Autocomplete suggestions
  const [authorSuggestions, setAuthorSuggestions] = useState<string[]>([]);
  const [genreSuggestions, setGenreSuggestions] = useState<string[]>([]);
  const [languageSuggestions, setLanguageSuggestions] = useState<string[]>([]);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [activeInput, setActiveInput] = useState<"author" | "genre" | "language" | "book" | null>(null);

  // Debounced autocomplete suggestions fetching
  useEffect(() => {
    if (!token || !filterAuthor || filterAuthor.length < 1) {
      setAuthorSuggestions([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await api.getFilterSuggestions(token, filterAuthor, "author");
        setAuthorSuggestions(res);
      } catch {}
    }, 250);
    return () => clearTimeout(delay);
  }, [filterAuthor, token]);

  useEffect(() => {
    if (!token || !filterGenre || filterGenre.length < 1) {
      setGenreSuggestions([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await api.getFilterSuggestions(token, filterGenre, "genre");
        setGenreSuggestions(res);
      } catch {}
    }, 250);
    return () => clearTimeout(delay);
  }, [filterGenre, token]);

  useEffect(() => {
    if (!token || !filterLanguage || filterLanguage.length < 1) {
      setLanguageSuggestions([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await api.getFilterSuggestions(token, filterLanguage, "language");
        setLanguageSuggestions(res);
      } catch {}
    }, 250);
    return () => clearTimeout(delay);
  }, [filterLanguage, token]);

  useEffect(() => {
    if (!token || !filterTitle || filterTitle.length < 1) {
      setTitleSuggestions([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await api.getFilterSuggestions(token, filterTitle, "book");
        setTitleSuggestions(res);
      } catch {}
    }, 250);
    return () => clearTimeout(delay);
  }, [filterTitle, token]);

  useEffect(() => {
    if (!authLoading && !user && !token) router.push("/auth/login");
  }, [authLoading, user, token, router]);

  useEffect(() => {
    if (!token) return;
    load(false);
    
    api.getLibrary(token).then((entries) => {
      const map: Record<string, string> = {};
      entries.forEach(e => { map[e.book_id] = e.interaction_type; });
      setLibraryMap(map);
    }).catch(() => {});
  }, [token]);

  const [error, setError] = useState<string | null>(null);

  const load = async (refresh: boolean) => {
    if (!token) return;
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (filterAuthor) filters.author = filterAuthor;
      if (filterGenre) filters.genre = filterGenre;
      if (filterLanguage) filters.language = filterLanguage;
      if (filterTitle) filters.title = filterTitle;
      
      const data = await api.getRecommendations(token, refresh, filters);
      setRecs(data);
      setDismissed(new Set());
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error && err.message ? err.message : "Failed to load recommendations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFeedback = async (recId: string, action: "clicked" | "dismissed" | "not_interested") => {
    if (!token) return;
    try {
      await api.sendRecommendationFeedback(recId, action, token);
    } catch {}
    if (action !== "clicked") {
      setDismissed((prev) => new Set([...prev, recId]));
    }
  };

  const handleAddToLibrary = async (bookId: string, recId: string, type: string = "want_to_read") => {
    if (!token) { router.push("/auth/login"); return; }
    try {
      setLibraryMap(prev => ({ ...prev, [bookId]: type }));
      await api.addToLibrary(bookId, { interaction_type: type }, token);
      await handleFeedback(recId, type === "not_interested" ? "not_interested" : "clicked");
    } catch {}
  };

  const visible = recs.filter((r) => !dismissed.has(r.id));

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-amber-600/6 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-brand-600/8 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-8 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <Sparkles size={20} className="text-amber-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Discover</h1>
              <p className="text-white/40 text-sm">Personalised just for you</p>
            </div>
          </div>
          <button
            id="recs-refresh"
            onClick={() => load(true)}
            disabled={refreshing}
            className="btn-secondary text-sm"
          >
            <RefreshCw size={16} className={clsx(refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* Filters */}
        <form 
          onSubmit={(e) => { e.preventDefault(); load(true); }}
          className="mb-8 p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-4"
        >
          {/* Primary Book Search Bar */}
          <div className="relative">
            <label className="text-xs text-white/50 mb-1.5 block px-1 font-medium">Search Book Name</label>
            <input 
              type="text" 
              placeholder="e.g. Harry Potter and the Chamber of Secrets"
              value={filterTitle}
              onChange={(e) => setFilterTitle(e.target.value)}
              onFocus={() => setActiveInput("book")}
              onBlur={() => setTimeout(() => setActiveInput(null), 200)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-colors"
            />
            {activeInput === "book" && titleSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-[#1a1a24] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                {titleSuggestions.map((s) => (
                  <div 
                    key={s} 
                    onClick={() => { setFilterTitle(s); setTitleSuggestions([]); }}
                    className="px-4 py-2 text-sm text-white/80 hover:bg-brand-500 hover:text-white cursor-pointer transition-colors"
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Row filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <label className="text-xs text-white/50 mb-1.5 block px-1">Author</label>
              <input 
                type="text" 
                placeholder="e.g. Lewis Carroll"
                value={filterAuthor}
                onChange={(e) => setFilterAuthor(e.target.value)}
                onFocus={() => setActiveInput("author")}
                onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-500 transition-colors"
              />
              {activeInput === "author" && authorSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-[#1a1a24] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {authorSuggestions.map((s) => (
                    <div 
                      key={s} 
                      onClick={() => { setFilterAuthor(s); setAuthorSuggestions([]); }}
                      className="px-4 py-2 text-sm text-white/80 hover:bg-brand-500 hover:text-white cursor-pointer transition-colors"
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 relative">
              <label className="text-xs text-white/50 mb-1.5 block px-1">Genre</label>
              <input 
                type="text" 
                placeholder="e.g. Fiction, Fantasy"
                value={filterGenre}
                onChange={(e) => setFilterGenre(e.target.value)}
                onFocus={() => setActiveInput("genre")}
                onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-500 transition-colors"
              />
              {activeInput === "genre" && genreSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-[#1a1a24] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {genreSuggestions.map((s) => (
                    <div 
                      key={s} 
                      onClick={() => { setFilterGenre(s); setGenreSuggestions([]); }}
                      className="px-4 py-2 text-sm text-white/80 hover:bg-brand-500 hover:text-white cursor-pointer transition-colors"
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 relative">
              <label className="text-xs text-white/50 mb-1.5 block px-1">Language</label>
              <input 
                type="text" 
                placeholder="e.g. English, eng"
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value)}
                onFocus={() => setActiveInput("language")}
                onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-500 transition-colors"
              />
              {activeInput === "language" && languageSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-[#1a1a24] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {languageSuggestions.map((s) => (
                    <div 
                      key={s} 
                      onClick={() => { setFilterLanguage(s); setLanguageSuggestions([]); }}
                      className="px-4 py-2 text-sm text-white/80 hover:bg-brand-500 hover:text-white cursor-pointer transition-colors"
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-end">
              <button 
                type="submit" 
                disabled={loading || refreshing}
                className="w-full md:w-auto btn-primary px-6 py-2 h-[38px] text-sm"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </form>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-amber-500/20 flex items-center justify-center">
                <Loader2 size={32} className="text-amber-400 animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-amber-500/30 animate-ping" />
            </div>
            <p className="text-white/40 text-sm">Building your recommendations…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-20 text-red-300">
            <p className="mb-4">{error}</p>
            <button onClick={() => load(true)} className="btn-secondary text-xs px-4 py-2 text-white">
              <RefreshCw size={14} className="inline mr-1.5" /> Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && visible.length === 0 && (
          <div className="text-center py-20">
            <Sparkles size={40} className="mx-auto mb-4 text-amber-400/40" />
            <h3 className="font-semibold text-xl mb-2">No recommendations yet</h3>
            <p className="text-white/40 text-sm mb-6">
              Scan and interact with a few books to help us learn your taste
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/scan" className="btn-primary">Scan a Book</Link>
              <button onClick={() => load(true)} className="btn-secondary">
                <RefreshCw size={16} /> Try Refresh
              </button>
            </div>
          </div>
        )}

        {/* Recommendation cards */}
        {!loading && visible.length > 0 && (
          <div className="space-y-5 stagger-children">
            {visible.map((rec) => {
              const book = rec.book;
              const authors =
                book?.authors
                  ?.map((a) => (typeof a === "string" ? a : a.name))
                  .join(", ") ?? "";
              const genres = book?.genres?.map((g) => (typeof g === "string" ? g : g.name)) ?? [];
              const isExpanded = expanded === rec.id;

              return (
                <div key={rec.id} className="card overflow-hidden">
                  {/* Reason banner */}
                  {rec.reason && (
                    <div className="bg-amber-500/8 border-b border-amber-500/15 px-5 py-2.5 flex items-start gap-2">
                      <Sparkles size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-200/80 leading-relaxed">{rec.reason}</p>
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex gap-4">
                      {/* Cover */}
                      <Link href={book ? `/books/${book.id}` : "#"} className="flex-shrink-0">
                        <div className="relative w-20 h-28 rounded-xl overflow-hidden shadow-card">
                          {book?.cover_url ? (
                            <Image src={book.cover_url} alt={book.title} fill className="object-cover" />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-800 to-brand-950 flex items-center justify-center">
                              <BookOpen size={22} className="text-brand-400/50" />
                            </div>
                          )}
                        </div>
                      </Link>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <Link href={book ? `/books/${book.id}` : "#"}>
                          <h3 className="font-bold text-lg leading-tight hover:text-brand-300 transition-colors line-clamp-2">
                            {book?.title ?? "Unknown"}
                          </h3>
                        </Link>
                        <p className="text-white/40 text-sm mt-0.5 truncate">{authors}</p>

                        {/* Genres */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {genres.slice(0, 3).map((g) => (
                            <span key={g} className="badge-brand text-xs">{g}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Description (expandable) */}
                    {book?.description && (
                      <div className="mt-4">
                        <p className={clsx("text-sm text-white/50 leading-relaxed", !isExpanded && "line-clamp-2")}>
                          {book.description}
                        </p>
                        <button
                          onClick={() => setExpanded(isExpanded ? null : rec.id)}
                          className="text-xs text-brand-300 hover:text-brand-200 mt-1 flex items-center gap-1"
                        >
                          <Info size={12} />
                          {isExpanded ? "Show less" : "Read more"}
                        </button>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/8">
                      <div className="relative flex-1">
                        <select
                          id={`rec-save-${rec.id}`}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddToLibrary(book!.id, rec.id, e.target.value);
                            }
                          }}
                          value={libraryMap[book!.id] || ""}
                          className={clsx(
                            "w-full text-sm py-2.5 appearance-none cursor-pointer px-4 text-center rounded-xl transition-all duration-200 ease-out font-semibold",
                            libraryMap[book!.id]
                              ? "bg-red-500 hover:bg-red-600 text-white"
                              : "btn-primary"
                          )}
                        >
                          <option value="" disabled>Save to Library...</option>
                          <option value="want_to_read">Want to Read</option>
                          <option value="reading">Reading</option>
                          <option value="finished">Finished</option>
                          <option value="favourited">Favourite</option>
                        </select>
                      </div>
                      <Link
                        href={book ? `/books/${book.id}` : "#"}
                        onClick={() => handleFeedback(rec.id, "clicked")}
                        className="btn-secondary text-sm py-2.5 px-4"
                      >
                        <BookOpen size={16} /> Details
                      </Link>
                      <button
                        id={`rec-dismiss-${rec.id}`}
                        onClick={() => handleAddToLibrary(book!.id, rec.id, "not_interested")}
                        className="btn-icon text-white/30 hover:text-red-400"
                        title="Not interested"
                      >
                        <ThumbsDown size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dismissed count */}
        {dismissed.size > 0 && (
          <p className="text-center text-white/25 text-sm mt-6">
            {dismissed.size} recommendation{dismissed.size > 1 ? "s" : ""} hidden
          </p>
        )}
      </div>
    </div>
  );
}
