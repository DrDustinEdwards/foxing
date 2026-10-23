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
type PersonHit = { username: string; displayName: string };
type ClubHit = { slug: string; name: string };

const RECENT_KEY = "foxing:recent-searches";
const RECENT_MAX = 6;

// GO TO quick links. Public entries show to everyone; the signed-in set is appended for
// authed users. Every target is a real route (Quotes is cut and never appears).
const PUBLIC_LINKS = [
  { to: "/books", label: "Browse books" },
  { to: "/clubs", label: "Reading clubs" },
  { to: "/picks", label: "Celebrity picks" },
  { to: "/journal", label: "Journal" },
];
const SIGNED_IN_LINKS = [
  { to: "/lists", label: "Reading lists" },
  { to: "/people", label: "Readers" },
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
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [clubs, setClubs] = useState<ClubHit[]>([]);
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
      setPeople([]);
      setClubs([]);
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
      setPeople([]);
      setClubs([]);
      return;
    }
    timer.current = setTimeout(async () => {
      abort.current?.abort();
      abort.current = new AbortController();
      try {
        const res = await fetch(`/search/suggest?q=${encodeURIComponent(q)}`, {
          signal: abort.current.signal,
        });
        const data = (await res.json()) as {
          books: BookHit[];
          authors: AuthorHit[];
          people?: PersonHit[];
          clubs?: ClubHit[];
        };
        setBooks(data.books ?? []);
        setAuthors(data.authors ?? []);
        setPeople(data.people ?? []);
        setClubs(data.clubs ?? []);
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
    void navigate(to);
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
      overlayClassName="fx-cmd-overlay"
      contentClassName="fx-cmd-content"
      className="fx-cmd"
    >
      <div className="fx-cmd-head">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
          <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search books, people, clubs..."
          className="fx-cmd-input"
        />
      </div>

      <Command.List className="fx-cmd-list">
        {typing ? (
          <Command.Empty className="fx-cmd-empty">
            Nothing found. Press Enter to search everything.
          </Command.Empty>
        ) : null}

        {typing ? (
          <Command.Item
            value={`search:${query}`}
            onSelect={() => runSearch(query)}
            className="fx-cmd-item"
          >
            Search all results for &ldquo;{query.trim()}&rdquo;
          </Command.Item>
        ) : null}

        {typing && books.length > 0 ? (
          <Command.Group heading="Books">
            {books.map((b) => (
              <Command.Item
                key={b.slug}
                value={`book:${b.slug}`}
                onSelect={() => go(`/books/${b.slug}`)}
                className="fx-cmd-item"
              >
                <span className="truncate fx-cmd-title">{b.title}</span>
                <span className="truncate meta">· {b.author}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {typing && authors.length > 0 ? (
          <Command.Group heading="Authors">
            {authors.map((a) => (
              <Command.Item
                key={a.slug}
                value={`author:${a.slug}`}
                onSelect={() => go(`/authors/${a.slug}`)}
                className="fx-cmd-item spread"
              >
                <span className="truncate ink">{a.name}</span>
                <span className="shrink-0 mono xsmall dim">
                  {a.bookCount} {a.bookCount === 1 ? "book" : "books"}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {typing && people.length > 0 ? (
          <Command.Group heading="People">
            {people.map((p) => (
              <Command.Item
                key={p.username}
                value={`person:${p.username}`}
                onSelect={() => go(`/u/${p.username}`)}
                className="fx-cmd-item"
              >
                <span className="truncate ink">{p.displayName}</span>
                <span className="truncate mono xsmall dim">@{p.username}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {typing && clubs.length > 0 ? (
          <Command.Group heading="Clubs">
            {clubs.map((c) => (
              <Command.Item
                key={c.slug}
                value={`club:${c.slug}`}
                onSelect={() => go(`/clubs/${c.slug}`)}
                className="fx-cmd-item"
              >
                <span className="truncate ink">{c.name}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {!typing && recent.length > 0 ? (
          <Command.Group heading="Recent">
            {recent.map((r) => (
              <Command.Item
                key={r}
                value={`recent:${r}`}
                onSelect={() => runSearch(r)}
                className="fx-cmd-item"
              >
                {r}
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {!typing ? (
          <Command.Group heading="Go to">
            {(signedIn ? [...SIGNED_IN_LINKS, ...PUBLIC_LINKS] : PUBLIC_LINKS).map((l) => (
              <Command.Item
                key={l.to}
                value={`go:${l.to}`}
                onSelect={() => go(l.to)}
                className="fx-cmd-item"
              >
                {l.label}
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
      </Command.List>

      <div className="fx-cmd-foot">
        <span>
          <kbd>Enter</kbd> to open
        </span>
        <span>
          <kbd>Esc</kbd> to close
        </span>
      </div>
    </Command.Dialog>
  );
}
