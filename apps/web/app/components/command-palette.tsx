// The search palette: Capsomer's command menu, opened by Ctrl K, Cmd K, "/" or the header's
// search button (which dispatches "foxing:search-open"). Recent searches and quick links are
// its commands; typing federates catalog books, authors, people and clubs from /search/suggest
// through the menu's live search.
import { type Command, CommandMenu } from "capsomer/react/command-menu";
import { useEffect, useState } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import type { loader as RootLoader } from "~/root";

type Suggest = {
  books?: { slug: string; title: string; author: string }[];
  authors?: { slug: string; name: string; bookCount: number }[];
  people?: { username: string; displayName: string }[];
  clubs?: { slug: string; name: string }[];
};

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
  const next = [query, ...readRecent().filter((r) => r !== query)].slice(0, RECENT_MAX);
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
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("foxing:search-open", onOpen);
    return () => window.removeEventListener("foxing:search-open", onOpen);
  }, []);

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  const go = (to: string) => () => void navigate(to);
  const runSearch = (q: string) => () => {
    pushRecent(q);
    void navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const commands: Command[] = [
    ...recent.map((r) => ({ id: `recent:${r}`, label: r, group: "Recent", run: runSearch(r) })),
    ...(signedIn ? [...SIGNED_IN_LINKS, ...PUBLIC_LINKS] : PUBLIC_LINKS).map((l) => ({
      id: `go:${l.to}`,
      label: l.label,
      group: "Go to",
      run: go(l.to),
    })),
  ];

  async function search(q: string, signal: AbortSignal): Promise<Command[]> {
    const all: Command = {
      id: "search:all",
      label: `Search all results for “${q}”`,
      group: "Search",
      run: runSearch(q),
    };
    if (q.length < 2) return [all];
    const res = await fetch(`/search/suggest?q=${encodeURIComponent(q)}`, { signal });
    const data = (await res.json()) as Suggest;
    return [
      all,
      ...(data.books ?? []).map((b) => ({
        id: `book:${b.slug}`,
        label: b.title,
        hint: b.author,
        group: "Books",
        run: go(`/books/${b.slug}`),
      })),
      ...(data.authors ?? []).map((a) => ({
        id: `author:${a.slug}`,
        label: a.name,
        hint: `${a.bookCount} ${a.bookCount === 1 ? "book" : "books"}`,
        group: "Authors",
        run: go(`/authors/${a.slug}`),
      })),
      ...(data.people ?? []).map((p) => ({
        id: `person:${p.username}`,
        label: p.displayName,
        hint: `@${p.username}`,
        group: "People",
        run: go(`/u/${p.username}`),
      })),
      ...(data.clubs ?? []).map((c) => ({
        id: `club:${c.slug}`,
        label: c.name,
        group: "Clubs",
        run: go(`/clubs/${c.slug}`),
      })),
    ];
  }

  return (
    <CommandMenu
      open={open}
      onOpenChange={setOpen}
      commands={commands}
      search={search}
      label="Search Foxing"
      placeholder="Search books, people, clubs..."
    />
  );
}
