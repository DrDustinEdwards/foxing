import { formatCount } from "@drdustinedwards/site-helpers/text";
import type { RecapPage } from "@foxing/types";
import { Link } from "capsomer/react/link";

// The year's four numbers, shared by the Year in Reading page and the public recap (routes/recap.tsx).
export function YearNumbers({ recap }: { recap: RecapPage["recap"] }) {
  const stats = [
    { label: "books finished", value: recap.booksFinished },
    { label: "words read", value: formatCount(recap.totalWords) },
    { label: "distinct authors", value: recap.distinctAuthors },
    {
      label: "average rating",
      value: recap.averageRating != null ? recap.averageRating.toFixed(1) : "-",
    },
  ];
  return (
    <section className="fx-year-grid">
      {stats.map((s) => (
        <div key={s.label} className="cap-text cap-card" data-align="center">
          <p className="cap-title" data-size="2">
            {s.value}
          </p>
          <p className="fx-year-caps">{s.label}</p>
        </div>
      ))}
    </section>
  );
}

// The year's top books, shared with the public recap.
export function TopBooks({ books }: { books: RecapPage["recap"]["topBooks"] }) {
  if (books.length === 0) return null;
  return (
    <section className="cap-stack">
      <h2 className="cap-title" data-size="3">
        Top books
      </h2>
      <ol className="cap-stack" data-gap="3">
        {books.map((b) => (
          <li key={b.bookId} className="py-3 fx-year-card-2">
            <Link to={`/books/${b.slug}`} className="fx-year-link">
              {b.title}
            </Link>
            <span className="fx-year-label">
              {b.ratingHalf != null ? `${(b.ratingHalf / 2).toFixed(1)}★` : ""}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
