// Legacy path 301s. SEO best practice: new names win, old names one-hop to them,
// internal links already point at the new names. Every target below is a live route
// that is never itself redirected, so there are no chains. Kept as a pure function so
// the Worker and its tests share one source of truth.
//   celebrity picks: /book-clubs[/:slug] -> /picks[/:slug]
//   auth renames:    /sign-in -> /login, /sign-up -> /signup
//   profile subpages consolidated onto /u/:username (recap stays live)
//   cut features (no browse route): /series -> /books, /quotes -> /journal,
//     /buddy-reads -> /clubs. Any child path collapses to the same target (one hop).
export function legacyRedirectTarget(pathname: string): string | null {
  if (pathname === "/sign-in") return "/login";
  if (pathname === "/sign-up") return "/signup";
  if (pathname === "/book-clubs") return "/picks";
  if (pathname.startsWith("/book-clubs/")) {
    return `/picks/${pathname.slice("/book-clubs/".length)}`;
  }
  if (pathname === "/series" || pathname.startsWith("/series/")) return "/books";
  if (pathname === "/quotes" || pathname.startsWith("/quotes/")) return "/journal";
  if (pathname === "/buddy-reads" || pathname.startsWith("/buddy-reads/")) return "/clubs";
  const sub = pathname.match(/^\/u\/([^/]+)\/(.+)$/);
  if (sub && !sub[2].startsWith("recap/")) return `/u/${sub[1]}`;
  return null;
}
