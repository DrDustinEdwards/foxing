import { useEffect, useId, useRef, useState } from "react";
import { Form, useNavigate } from "react-router";

type Suggestion = { slug: string; title: string; author: string };

/**
 * Accessible search-as-you-type combobox. Debounced suggestions come from the
 * /search/suggest JSON route; submitting the form runs the full /search (which
 * includes the fuzzy fallback). Degrades to a plain GET form without JS.
 */
export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const navigate = useNavigate();
  const listId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      abort.current?.abort();
    };
  }, []);

  function onChange(value: string) {
    setQ(value);
    setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      abort.current?.abort();
      abort.current = new AbortController();
      try {
        const res = await fetch(`/search/suggest?q=${encodeURIComponent(value)}`, {
          signal: abort.current.signal,
        });
        const data = (await res.json()) as { books: Suggestion[] };
        setItems(data.books);
        setOpen(data.books.length > 0);
      } catch {
        /* aborted or offline: leave the last suggestions in place */
      }
    }, 180);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      void navigate(`/books/${items[active].slug}`);
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Form method="get" action="/search" role="search" onSubmit={() => setOpen(false)}>
        <label htmlFor="q" className="cap-sr-only">
          Search books and authors
        </label>
        <div className="cap-input-group fx-search-field">
          <div className="cap-input-addon" data-align="inline-start">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
              <path
                d="m20 20-3.2-3.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <input
            id="q"
            name="q"
            type="search"
            autoComplete="off"
            value={q}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => items.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            placeholder="Search titles and authors"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            className="cap-input"
          />
        </div>
      </Form>

      {open ? (
        // WAI-ARIA combobox popup: listbox with option children on generic elements.
        // Focus stays on the input and moves via aria-activedescendant; options carry
        // tabIndex={-1} so they are programmatically focusable but out of the tab order.
        <div id={listId} role="listbox" className="cap-listbox fx-suggest">
          {items.map((s, i) => (
            <div
              key={s.slug}
              id={`${listId}-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={active === i}
              className="cap-option"
              data-active={active === i ? "" : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                void navigate(`/books/${s.slug}`);
                setOpen(false);
              }}
            >
              <span className="cap-option-label">
                <span className="display-s">{s.title}</span>
                <span className="meta"> · {s.author}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
