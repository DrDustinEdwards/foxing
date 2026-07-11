// Federated search results grouped by entity (Books, Authors). Each group is a
// labelled section with its own heading + count; a polite live region announces the
// totals so a screen-reader user hears the result set change (an AA gap in legacy).
import { Link } from "react-router";
import { BookCard, type BookCardData, BookGrid } from "~/components/book-card";
import { EmptyState } from "~/components/ui";

export type AuthorResult = { author: string; authorSlug: string; bookCount: number };

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
      <p role="status" aria-live="polite" className="mb-6 font-ui text-sm text-tertiary">
        {fuzzy ? (
          <>
            No exact match for <span className="text-secondary">&ldquo;{q}&rdquo;</span>. Showing
            the closest results.
          </>
        ) : nothing ? (
          <span className="sr-only">No results for {q}.</span>
        ) : (
          <>
            {bookTotal.toLocaleString()} {bookTotal === 1 ? "book" : "books"}
            {authors.length
              ? ` and ${authors.length} ${authors.length === 1 ? "author" : "authors"}`
              : ""}{" "}
            for <span className="text-secondary">&ldquo;{q}&rdquo;</span>.
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
          <h2
            id="results-authors"
            className="mb-4 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-tertiary"
          >
            Authors · {authors.length}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {authors.map((a) => (
              <li key={a.authorSlug}>
                <Link
                  to={`/authors/${a.authorSlug}`}
                  className="flex items-center justify-between gap-3 rounded-card border border-border-subtle bg-surface px-4 py-3 shadow-card-sm transition-shadow hover:shadow-card-md"
                >
                  <span className="truncate font-display text-base text-primary">{a.author}</span>
                  <span className="shrink-0 font-mono text-xs text-tertiary">
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
          <h2
            id="results-books"
            className="mb-4 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-tertiary"
          >
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
