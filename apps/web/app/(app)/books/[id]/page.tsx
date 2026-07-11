"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, BookOpen, Star, Calendar, Building2,
  FileText, Globe, Hash, Loader2, CheckCircle, Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as api from "@/lib/api";
import clsx from "clsx";

const STATUSES = [
  { value: "want_to_read", label: "Want to Read", emoji: "📖" },
  { value: "reading", label: "Reading", emoji: "📚" },
  { value: "finished", label: "Finished", emoji: "✅" },
  { value: "favourited", label: "Favourite", emoji: "⭐" },
  { value: "not_interested", label: "Not Interested", emoji: "👎" },
];

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [book, setBook] = useState<api.Book | null>(null);
  const [similar, setSimilar] = useState<api.Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.getBook(id, token ?? undefined),
      api.getSimilarBooks(id, token ?? undefined).catch(() => []),
    ])
      .then(([b, sim]) => {
        setBook(b);
        setSimilar(sim);
      })
      .finally(() => setLoading(false));
  }, [id, token]);

  // Fetch current library status
  useEffect(() => {
    if (!token || !id) return;
    api.getLibrary(token).then((entries) => {
      const entry = entries.find((e) => e.book_id === id);
      if (entry) {
        setActiveStatus(entry.interaction_type);
        setRating(entry.rating ?? 0);
      }
    }).catch(() => {});
  }, [token, id]);

  const handleStatusChange = async (status: string) => {
    if (!token) { router.push("/auth/login"); return; }
    setStatusLoading(true);
    try {
      await api.addToLibrary(id, { interaction_type: status, rating: rating || undefined }, token);
      setActiveStatus(status);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleRating = async (r: number) => {
    if (!token) return;
    setRating(r);
    if (activeStatus) {
      await api.updateLibraryEntry(id, { rating: r }, token).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={36} className="text-brand-400 animate-spin" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-24 text-white/40">
        <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
        <p>Book not found.</p>
      </div>
    );
  }

  const authors = book.authors?.map((a) => (typeof a === "string" ? a : a.name)).join(", ");
  const genres = book.genres?.map((g) => (typeof g === "string" ? g : g.name));
  const desc = book.description ?? "";
  const shortDesc = desc.slice(0, 280);

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-brand-600/8 rounded-full blur-[150px]" />
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 relative">
        {/* Back */}
        <button onClick={() => router.back()} className="btn-ghost mb-6 -ml-2">
          <ArrowLeft size={18} /> Back
        </button>

        {/* Hero: cover + info */}
        <div className="flex gap-6 mb-8">
          <div className="flex-shrink-0 relative w-32 h-48 md:w-40 md:h-60 rounded-2xl overflow-hidden shadow-card">
            {book.cover_url ? (
              <Image src={book.cover_url} alt={book.title} fill className="object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-brand-800 to-brand-950 flex items-center justify-center">
                <BookOpen size={40} className="text-brand-400/60" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-black leading-tight mb-1">{book.title}</h1>
            {book.subtitle && <p className="text-white/50 text-base mb-2">{book.subtitle}</p>}
            {authors && <p className="text-brand-300 font-medium mb-3">{authors}</p>}

            {/* Meta pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {book.publication_date && (
                <span className="badge bg-white/8 text-white/50 gap-1">
                  <Calendar size={12} /> {new Date(book.publication_date).getFullYear()}
                </span>
              )}
              {book.page_count && (
                <span className="badge bg-white/8 text-white/50 gap-1">
                  <FileText size={12} /> {book.page_count} pages
                </span>
              )}
              {book.language && (
                <span className="badge bg-white/8 text-white/50 gap-1 uppercase">
                  <Globe size={12} /> {book.language}
                </span>
              )}
              {book.isbn_13 && (
                <span className="badge bg-white/8 text-white/50 gap-1">
                  <Hash size={12} /> {book.isbn_13}
                </span>
              )}
            </div>

            {/* Community rating */}
            {book.average_rating !== undefined && book.average_rating !== null && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      size={14}
                      className={i <= Math.round(book.average_rating!) ? "text-amber-400 fill-amber-400" : "text-white/15"}
                    />
                  ))}
                </div>
                <span className="text-sm text-white/50">
                  {book.average_rating.toFixed(1)} community rating
                </span>
              </div>
            )}

            {/* Publisher */}
            {book.publisher && (
              <div className="flex items-center gap-1.5 text-white/30 text-sm">
                <Building2 size={13} />
                {book.publisher}
              </div>
            )}
          </div>
        </div>

        {/* User rating */}
        {token && (
          <div className="card p-5 mb-6">
            <p className="text-sm text-white/50 mb-3">Your rating</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  id={`book-rate-${star}`}
                  onClick={() => handleRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-125"
                >
                  <Star
                    size={28}
                    className={clsx(
                      "transition-colors",
                      star <= (hoverRating || rating)
                        ? "text-amber-400 fill-amber-400"
                        : "text-white/15"
                    )}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-sm text-white/30">{rating}/5</span>
              )}
            </div>
          </div>
        )}

        {/* Add to library */}
        <div className="card p-5 mb-6">
          <p className="text-sm text-white/50 mb-3">Add to your library</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                id={`book-status-${s.value}`}
                onClick={() => handleStatusChange(s.value)}
                disabled={statusLoading}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all duration-200",
                  activeStatus === s.value
                    ? "bg-brand-500/25 border-brand-400/50 text-brand-200"
                    : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
                )}
              >
                {statusLoading && activeStatus === s.value
                  ? <Loader2 size={14} className="animate-spin" />
                  : s.emoji}
                {s.label}
                {activeStatus === s.value && <CheckCircle size={13} />}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        {desc && (
          <div className="card p-5 mb-6">
            <h2 className="font-bold text-lg mb-3">About this book</h2>
            <p className="text-white/60 leading-relaxed text-sm">
              {descExpanded ? desc : shortDesc}
              {desc.length > 280 && (
                <>
                  {!descExpanded && "…"}
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="ml-2 text-brand-300 hover:text-brand-200 transition-colors font-medium"
                  >
                    {descExpanded ? "Show less" : "Read more"}
                  </button>
                </>
              )}
            </p>
          </div>
        )}

        {/* Genres */}
        {genres && genres.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-3">Genres</h2>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <span key={g} className="badge-brand">{g}</span>
              ))}
            </div>
          </div>
        )}

        {/* Similar books */}
        {similar.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-brand-300" />
              <h2 className="font-bold text-lg">Similar Books</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {similar.slice(0, 6).map((sim) => (
                <Link key={sim.id} href={`/books/${sim.id}`}>
                  <div className="card overflow-hidden group cursor-pointer hover:-translate-y-1 transition-transform duration-300">
                    <div className="relative aspect-[2/3] bg-brand-900">
                      {sim.cover_url ? (
                        <Image src={sim.cover_url} alt={sim.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <BookOpen size={24} className="text-brand-400/40" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold line-clamp-2 leading-snug">{sim.title}</p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {sim.authors?.map((a) => (typeof a === "string" ? a : a.name)).join(", ")}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
