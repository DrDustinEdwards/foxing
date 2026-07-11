// Book picker for starting a diary entry when /diary/new was opened without a ?book=.
// Searches the catalog via /search/suggest and navigates to /diary/new?book=<slug> so
// the loader can resolve the book and render the form.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

type Suggestion = { slug: string; title: string; author: string };

export function DiaryBookPicker() {
  const navigate = useNavigate();
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

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-4">
      <label className="flex flex-col gap-2">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-tertiary">
          Find the book to log
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
            <li key={b.slug}>
              <button
                type="button"
                onClick={() => navigate(`/diary/new?book=${encodeURIComponent(b.slug)}`)}
                className="w-full rounded-cover px-3 py-2 text-left font-ui text-sm text-primary transition hover:bg-hover"
              >
                <span className="font-medium">{b.title}</span>{" "}
                <span className="text-tertiary">{b.author}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
