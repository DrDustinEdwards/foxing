// Owner-only control to add a book to a reading list. Searches the catalog as you type,
// then PUTs /api/v1/lists/:id/books with the chosen book id; the list refetches. Failed writes surface a visible error.
import { useAddListBook, useSuggest } from "@foxing/client";
import { useState } from "react";

export function AddBookToList({ listId }: { listId: string }) {
  const { run, error, pending } = useAddListBook();
  const [q, setQ] = useState("");
  const results = useSuggest(q, 200).books;

  async function add(book: { id: string }) {
    if (await run({ listId, bookId: book.id })) setQ("");
  }

  return (
    <div className="card">
      <label className="stack-2">
        <span className="group-label">Add a book</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the catalog"
          className="cap-input py-2"
        />
      </label>
      {results.length > 0 ? (
        <ul className="mt-2 fx-add-book-to-list-stack">
          {results.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => add(b)}
                disabled={pending}
                className="py-2 fx-add-book-to-list-btn"
              >
                <span className="fx-add-book-to-list-label">{b.title}</span>{" "}
                <span className="dim">{b.author}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 error xsmall">
          {error}
        </p>
      ) : null}
    </div>
  );
}
