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
    <div className="card">
      <label className="stack-2">
        <span className="group-label">Find the book to log</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the catalog"
          className="cap-input py-2"
        />
      </label>
      {results.length > 0 ? (
        <ul aria-label="Matching books" className="mt-2 stack-1">
          {results.map((b) => (
            <li key={b.slug}>
              <button
                type="button"
                onClick={() => navigate(`/diary/new?book=${encodeURIComponent(b.slug)}`)}
                className="fx-pick-option"
              >
                <span className="fx-diary-book-picker-label">{b.title}</span>{" "}
                <span className="dim">{b.author}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
