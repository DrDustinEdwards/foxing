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

/** Two rows of the most cards a row holds, so the second row is above the fold on a 1440 by 900 screen (web.dev: do not lazy-load the initial viewport). */
const GRID_FIRST_ROW = 10;

/** Capsomer's card as one destination: the link wraps the card's <div> (an <article> there leaves the link with no name). */
export function BookCard({
  book,
  className,
  position,
  headingLevel = 3,
}: {
  book: BookCardData;
  className?: string;
  position?: number;
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
        <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
          {book.author}
          {book.publicationYear ? (
            <span className="cap-text" data-tone="dim">
              {" "}
              &middot; {book.publicationYear}
            </span>
          ) : null}
        </p>
      </div>
    </Link>
  );
}

export function BookGrid({ children }: { children: React.ReactNode }) {
  return <div className="fx-book-grid">{children}</div>;
}
