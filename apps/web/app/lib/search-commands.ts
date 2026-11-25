// The search palette's commands, shared by the React palette and the search-palette island. No React and relative imports only: the islands are bundled on their own.
import type { Command } from "capsomer/behavior/command-menu";
import { readStored, writeStored } from "capsomer/behavior/hooks";
import { fetchSuggest } from "./book-suggest";

export const SEARCH_BUTTON_LABEL = "Search the catalog";
export const PALETTE_LABEL = "Search Foxing";
export const PALETTE_PLACEHOLDER = "Search books, people, clubs...";

export const RECENT_KEY = "foxing:recent-searches";
const RECENT_MAX = 6;

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

export function parseRecent(raw: string | null): string[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function readRecent(): string[] {
  return typeof window === "undefined" ? [] : parseRecent(readStored(RECENT_KEY));
}

function pushRecent(query: string) {
  const next = [query, ...readRecent().filter((r) => r !== query)].slice(0, RECENT_MAX);
  writeStored(RECENT_KEY, JSON.stringify(next));
}

export type Go = (to: string) => void;

const searchPage = (q: string) => `/search?q=${encodeURIComponent(q)}`;

function runSearch(go: Go, q: string) {
  return () => {
    pushRecent(q);
    go(searchPage(q));
  };
}

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

export async function liveCommands(q: string, signal: AbortSignal, go: Go): Promise<Command[]> {
  const all: Command = {
    id: "search:all",
    label: `Search all results for “${q}”`,
    group: "Search",
    run: runSearch(go, q),
  };
  if (q.length < 2) return [all];
  const data = await fetchSuggest(q, signal);
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
