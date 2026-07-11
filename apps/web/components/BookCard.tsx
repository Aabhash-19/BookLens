import Image from "next/image";
import Link from "next/link";
import { Star, BookOpen } from "lucide-react";
import clsx from "clsx";
import type { Book, BookSearchResult } from "@/lib/api";

interface BookCardProps {
  book: Book | BookSearchResult;
  showActions?: boolean;
  status?: string;
  onStatusChange?: (status: string) => void;
  className?: string;
  compact?: boolean;
}

const STATUSES = [
  { value: "want_to_read", label: "Want to Read", emoji: "📖" },
  { value: "reading", label: "Reading", emoji: "📚" },
  { value: "finished", label: "Finished", emoji: "✅" },
  { value: "favourited", label: "Favourite", emoji: "⭐" },
  { value: "not_interested", label: "Not Interested", emoji: "👎" },
];

function Stars({ rating }: { rating?: number }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={12}
          className={i <= Math.round(rating) ? "star-filled fill-amber-400" : "star-empty"}
        />
      ))}
      <span className="ml-1 text-xs text-white/50">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function BookCard({
  book,
  showActions = false,
  status,
  onStatusChange,
  className,
  compact = false,
}: BookCardProps) {
  const authors =
    "authors" in book && Array.isArray(book.authors)
      ? book.authors.map((a) => (typeof a === "string" ? a : a.name)).join(", ")
      : "";

  const cover = book.cover_url;
  const bookId = "id" in book ? book.id : undefined;
  const rating = "average_rating" in book ? book.average_rating : undefined;

  const content = (
    <div
      className={clsx(
        "card overflow-hidden group",
        compact ? "flex gap-3 p-3" : "flex flex-col",
        className
      )}
    >
      {/* Cover */}
      <div
        className={clsx(
          "relative flex-shrink-0 bg-surface-2 overflow-hidden",
          compact ? "w-14 h-20 rounded-lg" : "aspect-[2/3] rounded-t-2xl"
        )}
      >
        {cover ? (
          <Image
            src={cover}
            alt={`${book.title} cover`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes={compact ? "56px" : "(max-width: 768px) 50vw, 200px"}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-800 to-brand-950">
            <BookOpen size={compact ? 20 : 32} className="text-brand-400/60" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className={clsx("flex flex-col", compact ? "flex-1 min-w-0" : "p-4 flex-1")}>
        <h3
          className={clsx(
            "font-semibold text-white line-clamp-2 leading-snug",
            compact ? "text-sm" : "text-base mb-1"
          )}
        >
          {book.title}
        </h3>
        {authors && (
          <p className={clsx("text-white/50 truncate", compact ? "text-xs" : "text-sm mb-2")}>
            {authors}
          </p>
        )}
        {!compact && rating !== undefined && <Stars rating={rating} />}

        {!compact && showActions && onStatusChange && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUSES.slice(0, 3).map((s) => (
              <button
                key={s.value}
                onClick={(e) => {
                  e.preventDefault();
                  onStatusChange(s.value);
                }}
                className={clsx(
                  "text-xs px-2.5 py-1 rounded-full border transition-all duration-200",
                  status === s.value
                    ? "bg-brand-500/25 border-brand-400/50 text-brand-200"
                    : "border-white/10 text-white/40 hover:text-white/80 hover:border-white/30"
                )}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (bookId) {
    return (
      <Link href={`/books/${bookId}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
