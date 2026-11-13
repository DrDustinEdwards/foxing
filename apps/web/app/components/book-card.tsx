import { Link } from "capsomer/react/link";
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
 * Capsomer's card (capsomer/card.css), one destination: the link wraps the card's <div> (an <article> there leaves the link with no name), whose cover,
 * title and byline are its own children. The cover is the card's media, a 2:3 book cover.
 * Foxing's look (design-system Rule 15: the edge strengthens on hover, the title takes the
 * accent text) is catalog.css .fx-book.
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
  return (
    <Link to={`/books/${book.slug}`} className={className}>
      <div className="cap-card fx-book" data-ratio="2/3">
        <CoverImage
          className="cap-card-media"
          src={book.coverUrl}
          alt={`${book.title} by ${book.author}`}
          fallbackLabel={book.title}
          priority={position === 0}
          eager={position !== undefined && position < GRID_FIRST_ROW}
          sizes="(min-width: 64rem) 200px, (min-width: 40rem) 30vw, 45vw"
        />
        <Title>{book.title}</Title>
        <p className="cap-meta sans">
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
