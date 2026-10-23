// Book typeahead for admin forms (BOTM, celebrity picks). Reuses the public
// /search/suggest resource route, which returns { id, slug, title, author }, so no new
// endpoint is needed. Emits the selected book id (or null when cleared).
import { useEffect, useRef, useState } from "react";
import { adminInputClass } from "./admin-form";

type Suggestion = { id: string; slug: string; title: string; author: string };

export function BookPicker({
  selected,
  onPick,
}: {
  selected: { id: string; title: string; author: string } | null;
  onPick: (book: Suggestion | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/search/suggest?q=${encodeURIComponent(q)}`);
        const body = (await res.json()) as { books?: Suggestion[] };
        setResults(body.books ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  if (selected) {
    return (
      <div className="py-2 fx-book-picker-card">
        <span className="fx-book-picker-label">
          <span className="fx-book-picker-label-2">{selected.title}</span>
          <span className="dim"> by {selected.author}</span>
        </span>
        <button type="button" onClick={() => onPick(null)} className="shrink-0 fx-book-picker-btn">
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search the catalog by title or author"
        className={adminInputClass}
        aria-label="Search for a book"
      />
      {open && results.length > 0 ? (
        <ul className="mt-1 fx-book-picker-list">
          {results.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(b);
                  setOpen(false);
                  setQ("");
                }}
                className="fx-pick-option"
              >
                <span className="strong">{b.title}</span>
                <span className="dim"> by {b.author}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
