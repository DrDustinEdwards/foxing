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

/** Two rows of the most cards a row holds (five from 80rem, catalog.css): on a 1440 by 900 screen the second row is above the fold too, and web.dev says not to lazy-load images in the initial viewport. */
const GRID_FIRST_ROW = 10;

/**
 * Content-card variant (design-system Rule 15): the edge strengthens on hover and the
 * title takes the accent text. The whole card is the link target.
 */
export function BookCard({
  book,
  className,
  position,
  headingLevel = 3,
}: {
  book: BookCardData;
  className?: string;
  /** The card's place in its grid, from 0: the first is the page's LCP and the first row (up to five across) loads at once. */
  position?: number;
  /** The title's heading level: 2 when the grid sits directly under the page's h1, 3 under a section h2. */
  headingLevel?: 2 | 3;
}) {
  const Title = headingLevel === 2 ? "h2" : "h3";
  // One destination, so one link wraps the card's <article>; the regions (cover, title, byline)
  // are the article's own children, with no body wrapper (Modern Web Guidance "card").
  return (
    <Link to={`/books/${book.slug}`} className={cn("fx-book-card-link", className)}>
      <article className="fx-book-card">
        <CoverImage
          src={book.coverUrl}
          alt={`${book.title} by ${book.author}`}
          fallbackLabel={book.title}
          priority={position === 0}
          eager={position !== undefined && position < GRID_FIRST_ROW}
          sizes="(min-width: 1024px) 200px, (min-width: 640px) 30vw, 45vw"
        />
        <Title className="fx-book-card-title">{book.title}</Title>
        <p className="meta">
          {book.author}
          {book.publicationYear ? (
            <span className="dim"> &middot; {book.publicationYear}</span>
          ) : null}
        </p>
      </article>
    </Link>
  );
}

/** Responsive grid wrapper for book cards. */
export function BookGrid({ children }: { children: React.ReactNode }) {
  return <div className="fx-book-grid">{children}</div>;
}
