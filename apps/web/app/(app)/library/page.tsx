"use client";

import { useState, useEffect } from "react";
import { Library, BookOpen, Loader2, Star, Trash2, StickyNote, CheckCircle, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import * as api from "@/lib/api";
import clsx from "clsx";

const TABS = [
  { key: "want_to_read", label: "Want to Read", emoji: "📖" },
  { key: "reading", label: "Reading", emoji: "📚" },
  { key: "finished", label: "Finished", emoji: "✅" },
  { key: "favourited", label: "Favourites", emoji: "⭐" },
  { key: "not_interested", label: "Not Interested", emoji: "🚫" },
];

export default function LibraryPage() {
  const router = useRouter();
  const { token, user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("want_to_read");
  const [entries, setEntries] = useState<api.LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user && !token) router.push("/auth/login");
  }, [authLoading, user, token, router]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .getLibrary(token, activeTab)
      .then(setEntries)
      .catch(() => setError("Failed to load library."))
      .finally(() => setLoading(false));
  }, [token, activeTab]);

  const handleRemove = async (bookId: string) => {
    if (!token) return;
    try {
      await api.removeFromLibrary(bookId, token);
      setEntries((prev) => prev.filter((e) => e.book_id !== bookId));
    } catch {}
  };

  const handleRating = async (bookId: string, rating: number) => {
    if (!token) return;
    try {
      const updated = await api.updateLibraryEntry(bookId, { rating }, token);
      setEntries((prev) => prev.map((e) => (e.book_id === bookId ? { ...e, rating: updated.rating } : e)));
    } catch {}
  };

  const handleStatusChange = async (bookId: string, newStatus: string) => {
    if (!token) return;
    try {
      await api.updateLibraryEntry(bookId, { interaction_type: newStatus }, token);
      setEntries((prev) => prev.filter((e) => e.book_id !== bookId));
    } catch {}
  };

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-8 relative">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
            <Library size={20} className="text-purple-300" />
          </div>
          <div>
            <h1 className="text-2xl font-black">My Library</h1>
            <p className="text-white/40 text-sm">Your personal reading collection</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 glass rounded-2xl mb-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              id={`library-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                "flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap",
                activeTab === tab.key
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="text-brand-400 animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12 text-red-300">{error}</div>
        )}

        {!loading && !error && entries.length === 0 && (
          <EmptyState tab={activeTab} />
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="space-y-4 stagger-children">
            {entries.map((entry) => (
              <LibraryEntryCard
                key={entry.id}
                entry={entry}
                onRemove={handleRemove}
                onRating={handleRating}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LibraryEntryCard({
  entry,
  onRemove,
  onRating,
  onStatusChange,
}: {
  entry: api.LibraryEntry;
  onRemove: (bookId: string) => void;
  onRating: (bookId: string, rating: number) => void;
  onStatusChange: (bookId: string, status: string) => void;
}) {
  const book = entry.book;
  const [hoverRating, setHoverRating] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const coverUrl = book?.cover_url;

  const AUTHORS =
    book?.authors
      ?.map((a) => (typeof a === "string" ? a : a.name))
      .join(", ") ?? "";

  const nextStatuses = TABS.filter((t) => t.key !== entry.interaction_type).slice(0, 2);

  return (
    <div className="card p-4 animate-fade-in">
      <div className="flex gap-4">
        {/* Cover */}
        <Link href={book?.id ? `/books/${book.id}` : "#"} className="flex-shrink-0">
          <div className="relative w-16 h-24 rounded-lg overflow-hidden bg-brand-900">
            {coverUrl ? (
              <Image src={coverUrl} alt={book?.title ?? "Book"} fill className="object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <BookOpen size={20} className="text-brand-400/50" />
              </div>
            )}
          </div>
        </Link>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <Link href={book?.id ? `/books/${book.id}` : "#"}>
            <h3 className="font-bold text-base leading-tight hover:text-brand-300 transition-colors line-clamp-2">
              {book?.title ?? "Unknown title"}
            </h3>
          </Link>
          {AUTHORS && <p className="text-white/40 text-sm mt-0.5 truncate">{AUTHORS}</p>}

          {/* Star rating */}
          <div className="flex items-center gap-0.5 mt-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                id={`rate-${entry.book_id}-${star}`}
                onClick={() => onRating(entry.book_id, star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-125"
              >
                <Star
                  size={16}
                  className={clsx(
                    "transition-colors",
                    star <= (hoverRating || entry.rating || 0)
                      ? "text-amber-400 fill-amber-400"
                      : "text-white/15"
                  )}
                />
              </button>
            ))}
            {entry.rating && (
              <span className="ml-1 text-xs text-white/30">{entry.rating.toFixed(1)}</span>
            )}
          </div>

          {/* Description and Actions */}
          {book?.description ? (
            <div className="mt-4">
              <p className={clsx("text-sm text-white/50 leading-relaxed", !isExpanded && "line-clamp-2")}>
                {book.description}
              </p>
              <div className="flex items-center justify-between mt-1">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs text-brand-300 hover:text-brand-200 flex items-center gap-1"
                >
                  <Info size={12} />
                  {isExpanded ? "Show less" : "Read more"}
                </button>
                <button
                  onClick={() => onRemove(entry.book_id)}
                  id={`remove-${entry.book_id}`}
                  className="text-white/20 hover:text-red-400 transition-colors p-1"
                  title="Remove from library"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end mt-2">
              <button
                onClick={() => onRemove(entry.book_id)}
                id={`remove-${entry.book_id}`}
                className="text-white/20 hover:text-red-400 transition-colors p-1"
                title="Remove from library"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {entry.notes && (
        <div className="mt-3 pt-3 border-t border-white/8 flex gap-2 text-sm text-white/50">
          <StickyNote size={14} className="flex-shrink-0 mt-0.5" />
          <p className="line-clamp-2">{entry.notes}</p>
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab }: { tab: string }) {
  const current = TABS.find((t) => t.key === tab);
  return (
    <div className="text-center py-20 animate-fade-in">
      <div className="text-5xl mb-4">{current?.emoji ?? "📖"}</div>
      <h3 className="font-semibold text-xl mb-2">Nothing here yet</h3>
      <p className="text-white/40 text-sm mb-6">
        Scan a book to add it to your {current?.label.toLowerCase()} list
      </p>
      <Link href="/scan" className="btn-primary">
        <CheckCircle size={18} /> Scan a Book
      </Link>
    </div>
  );
}
