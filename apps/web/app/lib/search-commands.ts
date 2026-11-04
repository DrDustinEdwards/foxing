// The search palette's commands, shared by the React palette (components/command-palette.tsx) on a page that
// hydrates and the search-palette island (islands/search-palette.ts) on one that does not. Recent searches and
// quick links are its commands; typing federates catalog books, authors, people and clubs from
// /api/v1/search/suggest. No React and relative imports only: the islands are bundled on their own.
import type { Command } from "capsomer/behavior/command-menu";

/** The header's search button: its name, and how /site.js finds it on a page that does not hydrate. */
export const SEARCH_BUTTON_LABEL = "Search the catalog";
export const PALETTE_LABEL = "Search Foxing";
export const PALETTE_PLACEHOLDER = "Search books, people, clubs...";

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

export function readRecent(): string[] {
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

/** How a command moves the reader: React Router's navigate on a hydrated page, a page load otherwise. */
export type Go = (to: string) => void;

const searchPage = (q: string) => `/search?q=${encodeURIComponent(q)}`;

function runSearch(go: Go, q: string) {
  return () => {
    pushRecent(q);
    go(searchPage(q));
  };
}

/** The palette's own commands: recent searches, then the quick links. */
export function quickCommands(recent: string[], signedIn: boolean, go: Go): Command[] {
  return [
    ...recent.map((r) => ({ id: `recent:${r}`, label: r, group: "Recent", run: runSearch(go, r) })),
    ...(signedIn ? [...SIGNED_IN_LINKS, ...PUBLIC_LINKS] : PUBLIC_LINKS).map((l) => ({
      id: `go:${l.to}`,
      label: l.label,
      group: "Go to",
      run: () => go(l.to),
    })),
  ];
}

/** The live results for what the reader typed: "search all", then the suggestions by kind. */
export async function liveCommands(q: string, signal: AbortSignal, go: Go): Promise<Command[]> {
  const all: Command = {
    id: "search:all",
    label: `Search all results for “${q}”`,
    group: "Search",
    run: runSearch(go, q),
  };
  if (q.length < 2) return [all];
  const res = await fetch(`/api/v1/search/suggest?q=${encodeURIComponent(q)}`, { signal });
  const data = (await res.json()) as Suggest;
  return [
    all,
    ...(data.books ?? []).map((b) => ({
      id: `book:${b.slug}`,
      label: b.title,
      hint: b.author,
      group: "Books",
      run: () => go(`/books/${b.slug}`),
    })),
    ...(data.authors ?? []).map((a) => ({
      id: `author:${a.slug}`,
      label: a.name,
      hint: `${a.bookCount} ${a.bookCount === 1 ? "book" : "books"}`,
      group: "Authors",
      run: () => go(`/authors/${a.slug}`),
    })),
    ...(data.people ?? []).map((p) => ({
      id: `person:${p.username}`,
      label: p.displayName,
      hint: `@${p.username}`,
      group: "People",
      run: () => go(`/u/${p.username}`),
    })),
    ...(data.clubs ?? []).map((c) => ({
      id: `club:${c.slug}`,
      label: c.name,
      group: "Clubs",
      run: () => go(`/clubs/${c.slug}`),
    })),
  ];
}
