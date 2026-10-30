// Shared by the commonplace and highlights pages: the search and book filter row, and the
// filtered annotations grouped under their book.
import type { ReactNode } from "react";
import { Link } from "capsomer/react/link";

type BookFields = {
  id: string;
  sourceTitle: string | null;
  bookTitle: string | null;
  bookSlug: string | null;
  bookAuthor: string | null;
};

export function bookKey(e: BookFields): string {
  return e.bookSlug ?? e.bookTitle ?? e.sourceTitle ?? "unknown";
}
function bookLabelOf(e: BookFields): string {
  return e.bookTitle ?? e.sourceTitle ?? "Unknown book";
}

// Distinct books present, in first-seen order, for the book filter.
export function bookOptions(entries: BookFields[]): Array<{ key: string; label: string }> {
  const books: Array<{ key: string; label: string }> = [];
  const seenBooks = new Set<string>();
  for (const e of entries) {
    const k = bookKey(e);
    if (!seenBooks.has(k)) {
      seenBooks.add(k);
      books.push({ key: k, label: bookLabelOf(e) });
    }
  }
  return books;
}

export function AnnotationFilters({
  query,
  onQuery,
  placeholder,
  label,
  inputClassName,
  books,
  book,
  onBook,
  shown,
  total,
  children,
}: {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  label: string;
  inputClassName: string;
  books: Array<{ key: string; label: string }>;
  book: string;
  onBook: (b: string) => void;
  shown: number;
  total: number;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 stack-3">
      <div className="row wrap">
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className={`cap-input ${inputClassName}`}
        />
        {books.length > 1 ? (
          <label className="ui">
            <span className="cap-sr-only">Filter by book</span>
            <select value={book} onChange={(e) => onBook(e.target.value)} className="cap-select">
              <option value="all">All books</option>
              {books.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {children}
      <span className="fine">
        {shown} of {total}
      </span>
    </div>
  );
}

export function BookGroups<T extends BookFields>({
  items,
  empty,
  renderItem,
}: {
  items: T[];
  empty: string;
  renderItem: (item: T) => ReactNode;
}) {
  // Group the filtered entries under their book.
  const groups: Array<{
    key: string;
    label: string;
    author: string | null;
    slug: string | null;
    items: T[];
  }> = [];
  const groupIndex = new Map<string, number>();
  for (const e of items) {
    const k = bookKey(e);
    let i = groupIndex.get(k);
    if (i === undefined) {
      i = groups.length;
      groupIndex.set(k, i);
      groups.push({
        key: k,
        label: bookLabelOf(e),
        author: e.bookAuthor,
        slug: e.bookSlug,
        items: [],
      });
    }
    groups[i].items.push(e);
  }

  if (groups.length === 0) return <p className="meta">{empty}</p>;
  return (
    <div className="stack-8">
      {groups.map((g) => (
        <section key={g.key} className="stack-3">
          <h2 className="display-0">
            {g.slug ? (
              <Link to={`/books/${g.slug}`} className="hover-accent">
                {g.label}
              </Link>
            ) : (
              g.label
            )}
            {g.author ? <span className="dim"> by {g.author}</span> : null}
          </h2>
          <ul className="stack-3">
            {g.items.map((e) => (
              <li key={e.id} className="card card-5">
                {renderItem(e)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
