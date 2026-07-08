import { Link } from "react-router";
import { cn } from "~/lib/cn";
import { CoverImage } from "./cover-image";

export type BookCardData = {
  slug: string;
  title: string;
  author: string;
  authorSlug?: string | null;
  coverUrl?: string | null;
  publicationYear?: number | null;
};

/**
 * Content-card variant (design-system Rule 15): border-subtle -> border-interactive
 * on hover, title -> brand-text on hover. The whole card is the link target.
 */
export function BookCard({
  book,
  priority,
  className,
}: {
  book: BookCardData;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Link
      to={`/books/${book.slug}`}
      className={cn(
        "group flex flex-col rounded-card border border-border-subtle bg-surface p-2.5 transition-colors hover:border-border-interactive",
        className,
      )}
    >
      <CoverImage
        src={book.coverUrl}
        alt={`${book.title} by ${book.author}`}
        fallbackLabel={book.title}
        priority={priority}
        sizes="(min-width: 1024px) 200px, (min-width: 640px) 30vw, 45vw"
      />
      <div className="mt-3 px-0.5 pb-1">
        <h3 className="font-display text-base leading-snug text-primary transition-colors group-hover:text-brand-text">
          {book.title}
        </h3>
        <p className="mt-1 font-ui text-sm text-tertiary">
          {book.author}
          {book.publicationYear ? (
            <span className="text-tertiary/80"> &middot; {book.publicationYear}</span>
          ) : null}
        </p>
      </div>
    </Link>
  );
}

/** Responsive grid wrapper for book cards. */
export function BookGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {children}
    </div>
  );
}
