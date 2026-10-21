// Owner-only control to add a book to a reading list. Searches the catalog via the
// existing /search/suggest resource route, then PUTs /api/v1/lists/:id/books with the
// chosen book id. Revalidates on success. Failed writes surface a visible error.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useApiWrite } from "~/hooks/use-api-write";

type Suggestion = { id: string; slug: string; title: string; author: string };

export function AddBookToList({ listId }: { listId: string }) {
  const navigate = useNavigate();
  const { write, error, pending } = useApiWrite();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/search/suggest?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { books?: Suggestion[] };
        setResults(data.books ?? []);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  async function add(book: Suggestion) {
    const res = await write(`/lists/${listId}/books`, { method: "PUT", body: { bookId: book.id } });
    if (res.ok) {
      setQ("");
      setResults([]);
      void navigate(".", { replace: true, preventScrollReset: true });
    }
  }

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-4">
      <label className="flex flex-col gap-2">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-tertiary">
          Add a book
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the catalog"
          className="rounded-cover border border-border-interactive bg-base px-3 py-2 font-ui text-sm text-primary"
        />
      </label>
      {results.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1">
          {results.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => add(b)}
                disabled={pending}
                className="w-full rounded-cover px-3 py-2 text-left font-ui text-sm text-primary transition hover:bg-hover disabled:opacity-50"
              >
                <span className="font-medium">{b.title}</span>{" "}
                <span className="text-tertiary">{b.author}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 font-ui text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
