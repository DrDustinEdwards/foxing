// Cmd/Ctrl+K command palette. Opens on the keyboard shortcut or the header search
// button (which dispatches "foxing:search-open"). Empty state shows recent searches
// and quick links; typing federates catalog books + authors from /search/suggest.
// Built on cmdk, which owns the focus trap, roving keyboard nav, and dialog a11y.
import { Command } from "cmdk";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import type { loader as RootLoader } from "~/root";

type BookHit = { slug: string; title: string; author: string };
type AuthorHit = { slug: string; name: string; bookCount: number };

const RECENT_KEY = "foxing:recent-searches";
const RECENT_MAX = 6;

const PUBLIC_LINKS = [
  { to: "/books", label: "Browse all books" },
  { to: "/awards", label: "Literary awards" },
  { to: "/picks", label: "Celebrity picks" },
  { to: "/book-of-the-month", label: "Book of the Month" },
  { to: "/journal", label: "The Journal" },
];
const SIGNED_IN_LINKS = [
  { to: "/home", label: "Home" },
  { to: "/library", label: "Your library" },
  { to: "/settings", label: "Settings" },
];

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function pushRecent(query: string) {
  if (typeof window === "undefined") return;
  const trimmed = query.trim();
  if (!trimmed) return;
  const next = [trimmed, ...readRecent().filter((r) => r !== trimmed)].slice(0, RECENT_MAX);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage disabled: recents just do not persist */
  }
}

export function CommandPalette() {
  const navigate = useNavigate();
  const root = useRouteLoaderData<typeof RootLoader>("root");
  const signedIn = !!root?.navUser;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [books, setBooks] = useState<BookHit[]>([]);
  const [authors, setAuthors] = useState<AuthorHit[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Open on Cmd/Ctrl+K, or when the header search button asks us to.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("foxing:search-open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("foxing:search-open", onOpen);
    };
  }, []);

  // Reset transient state each time the palette opens; refresh recent searches.
  useEffect(() => {
    if (open) {
      setQuery("");
      setBooks([]);
      setAuthors([]);
      setRecent(readRecent());
    }
  }, [open]);

  // Debounced federated fetch (books + authors) while typing.
  useEffect(() => {
    const q = query.trim();
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 2) {
      setBooks([]);
      setAuthors([]);
      return;
    }
    timer.current = setTimeout(async () => {
      abort.current?.abort();
      abort.current = new AbortController();
      try {
        const res = await fetch(`/search/suggest?q=${encodeURIComponent(q)}`, {
          signal: abort.current.signal,
        });
        const data = (await res.json()) as { books: BookHit[]; authors: AuthorHit[] };
        setBooks(data.books ?? []);
        setAuthors(data.authors ?? []);
      } catch {
        /* aborted or offline: keep the last results */
      }
    }, 180);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  function go(to: string) {
    setOpen(false);
    navigate(to);
  }

  function runSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    pushRecent(trimmed);
    go(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  const typing = query.trim().length >= 2;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Search Foxing"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-[99] bg-black/40 backdrop-blur-sm"
      contentClassName="fixed inset-0 z-[100] grid place-items-start justify-center p-4 pt-[12vh]"
      className="h-fit w-full max-w-xl overflow-hidden rounded-hero border border-border-subtle bg-surface shadow-card-md"
    >
      <div className="flex items-center gap-2 border-b border-border-subtle px-4">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0 text-tertiary"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
          <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search titles and authors"
          className="w-full bg-transparent py-3.5 font-ui text-base text-primary outline-none placeholder:text-tertiary"
        />
      </div>

      <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
        {typing ? (
          <Command.Empty className="px-3 py-6 text-center font-ui text-sm text-tertiary">
            Nothing found. Press Enter to search everything.
          </Command.Empty>
        ) : null}

        {typing ? (
          <Command.Item
            value={`search:${query}`}
            onSelect={() => runSearch(query)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 font-ui text-sm text-secondary data-[selected=true]:bg-hover data-[selected=true]:text-brand-text"
          >
            Search all results for &ldquo;{query.trim()}&rdquo;
          </Command.Item>
        ) : null}

        {typing && books.length > 0 ? (
          <Command.Group
            heading="Books"
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[0.625rem] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-tertiary"
          >
            {books.map((b) => (
              <Command.Item
                key={b.slug}
                value={`book:${b.slug}`}
                onSelect={() => go(`/books/${b.slug}`)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 data-[selected=true]:bg-hover"
              >
                <span className="truncate font-display text-sm text-primary">{b.title}</span>
                <span className="truncate font-ui text-sm text-tertiary">· {b.author}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {typing && authors.length > 0 ? (
          <Command.Group
            heading="Authors"
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[0.625rem] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-tertiary"
          >
            {authors.map((a) => (
              <Command.Item
                key={a.slug}
                value={`author:${a.slug}`}
                onSelect={() => go(`/authors/${a.slug}`)}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 data-[selected=true]:bg-hover"
              >
                <span className="truncate font-ui text-sm text-primary">{a.name}</span>
                <span className="shrink-0 font-mono text-xs text-tertiary">
                  {a.bookCount} {a.bookCount === 1 ? "book" : "books"}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {!typing && recent.length > 0 ? (
          <Command.Group
            heading="Recent"
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[0.625rem] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-tertiary"
          >
            {recent.map((r) => (
              <Command.Item
                key={r}
                value={`recent:${r}`}
                onSelect={() => runSearch(r)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 font-ui text-sm text-secondary data-[selected=true]:bg-hover data-[selected=true]:text-brand-text"
              >
                {r}
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {!typing ? (
          <Command.Group
            heading="Go to"
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[0.625rem] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-tertiary"
          >
            {(signedIn ? [...SIGNED_IN_LINKS, ...PUBLIC_LINKS] : PUBLIC_LINKS).map((l) => (
              <Command.Item
                key={l.to}
                value={`go:${l.to}`}
                onSelect={() => go(l.to)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 font-ui text-sm text-secondary data-[selected=true]:bg-hover data-[selected=true]:text-brand-text"
              >
                {l.label}
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
      </Command.List>
    </Command.Dialog>
  );
}
