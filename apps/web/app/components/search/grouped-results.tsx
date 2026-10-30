// Federated search results grouped by entity (Books, Authors). Each group is a
// labeled section with its own heading + count; a polite live region announces the
// totals so a screen-reader user hears the result set change (an AA gap in legacy).
import type { SearchPage } from "@foxing/types";
import { Link } from "capsomer/react/link";
import { BookCard, type BookCardData, BookGrid } from "~/components/book-card";
import { EmptyState } from "~/components/ui";

type AuthorResult = SearchPage["authors"][number];

export function GroupedResults({
  q,
  books,
  bookTotal,
  fuzzy,
  authors,
}: {
  q: string;
  books: BookCardData[];
  bookTotal: number;
  fuzzy: boolean;
  authors: AuthorResult[];
}) {
  const nothing = books.length === 0 && authors.length === 0;

  return (
    <div className="mt-8">
      <p role="status" aria-live="polite" className="mb-6 fx-grouped-results-text">
        {fuzzy ? (
          <>
            No exact match for <span className="muted">&ldquo;{q}&rdquo;</span>. Showing the closest
            results.
          </>
        ) : nothing ? (
          <span className="cap-sr-only">No results for {q}.</span>
        ) : (
          <>
            {bookTotal.toLocaleString()} {bookTotal === 1 ? "book" : "books"}
            {authors.length
              ? ` and ${authors.length} ${authors.length === 1 ? "author" : "authors"}`
              : ""}{" "}
            for <span className="muted">&ldquo;{q}&rdquo;</span>.
          </>
        )}
      </p>

      {nothing ? (
        <EmptyState
          title={`Nothing found for "${q}"`}
          body="Try an author's last name, or a word from the title."
        />
      ) : null}

      {authors.length > 0 ? (
        <section aria-labelledby="results-authors" className="mb-10">
          <h2 id="results-authors" className="mb-4 fx-grouped-results-caps">
            Authors · {authors.length}
          </h2>
          <ul className="fx-grouped-results-grid">
            {authors.map((a) => (
              <li key={a.slug}>
                <Link to={`/authors/${a.slug}`} className="fx-result-row">
                  <span className="truncate fx-grouped-results-title">{a.name}</span>
                  <span className="shrink-0 fx-grouped-results-label">
                    {a.bookCount} {a.bookCount === 1 ? "book" : "books"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {books.length > 0 ? (
        <section aria-labelledby="results-books">
          <h2 id="results-books" className="mb-4 fx-grouped-results-caps">
            Books · {bookTotal.toLocaleString()}
          </h2>
          <BookGrid>
            {books.map((b, i) => (
              <BookCard key={b.slug} book={b} priority={i < 6} />
            ))}
          </BookGrid>
        </section>
      ) : null}
    </div>
  );
}
