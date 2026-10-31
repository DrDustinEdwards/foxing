import { Link } from "capsomer/react/link";
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

/** The most cards a grid row holds (five from 80rem, catalog.css): the covers above the fold on any screen. */
const GRID_FIRST_ROW = 5;

/**
 * Content-card variant (design-system Rule 15): the edge strengthens on hover and the
 * title takes the accent text. The whole card is the link target.
 */
export function BookCard({
  book,
  className,
  position,
}: {
  book: BookCardData;
  className?: string;
  /** The card's place in its grid, from 0: the first is the page's LCP and the first row (up to five across) loads at once. */
  position?: number;
}) {
  return (
    <Link to={`/books/${book.slug}`} className={cn("fx-book-card", className)}>
      <CoverImage
        src={book.coverUrl}
        alt={`${book.title} by ${book.author}`}
        fallbackLabel={book.title}
        priority={position === 0}
        eager={position !== undefined && position < GRID_FIRST_ROW}
        sizes="(min-width: 1024px) 200px, (min-width: 640px) 30vw, 45vw"
      />
      <div className="fx-book-card-body">
        <h3 className="fx-book-card-title">{book.title}</h3>
        <p className="mt-1 meta">
          {book.author}
          {book.publicationYear ? (
            <span className="dim"> &middot; {book.publicationYear}</span>
          ) : null}
        </p>
      </div>
    </Link>
  );
}

/** Responsive grid wrapper for book cards. */
export function BookGrid({ children }: { children: React.ReactNode }) {
  return <div className="fx-book-grid">{children}</div>;
}
