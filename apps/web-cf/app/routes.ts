import { type RouteConfig, index, route } from "@react-router/dev/routes";
import { INDEXNOW_KEY } from "./lib/indexnow";

export default [
  index("routes/marketing.tsx"),
  route("home", "routes/home.tsx"),
  route("signup", "routes/signup.tsx"),
  route("login", "routes/login.tsx"),
  route("onboarding", "routes/onboarding.tsx"),
  route("me", "routes/me.tsx"),
  route("settings", "routes/settings.tsx"),
  route("forgot-password", "routes/forgot-password.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
  route("library", "routes/library.tsx"),
  route("shelves/:id", "routes/shelf-detail.tsx"),

  // Clubs (Phase 5). List + create (Plus-gated) + detail with the live layer + threads.
  route("clubs", "routes/clubs.tsx"),
  route("clubs/new", "routes/club-new.tsx"),
  route("clubs/:slug", "routes/club-detail.tsx"),
  route("clubs/:slug/t/:threadId", "routes/club-thread.tsx"),
  route("join/:code", "routes/join-code.tsx"),

  // Phase 4a TEMPORARY test surface. Remove once the reader hosts the companion.
  route("companion-test", "routes/companion-test.tsx"),

  // Public catalog (edge SSR + Cache API). Slugs for SEO (mobile uses ids).
  route("books", "routes/books.tsx"),
  route("books/:slug", "routes/book-detail.tsx"),
  route("authors/:slug", "routes/author.tsx"),
  route("awards", "routes/awards.tsx"),
  route("awards/:slug", "routes/award-detail.tsx"),
  route("picks", "routes/picks.tsx"),
  route("picks/:clubSlug", "routes/pick-club.tsx"),
  route("book-of-the-month", "routes/botm.tsx"),
  route("journal", "routes/journal.tsx"),
  route("journal/archive", "routes/journal-archive.tsx"),
  route("journal/tag/:tag", "routes/journal-tag.tsx"),
  route("journal/:slug", "routes/journal-post.tsx"),
  route("journal/rss.xml", "routes/journal-rss.tsx"),
  route("search", "routes/search.tsx"),
  route("search/suggest", "routes/search-suggest.tsx"),

  // Legal + content (static, edge-cached).
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  route("about", "routes/about.tsx"),
  route("features", "routes/features.tsx"),

  // SEO + share surfaces.
  route("og/book/:slug", "routes/og-book.tsx"),
  route("sitemap.xml", "routes/sitemap.tsx"),
  route("robots.txt", "routes/robots.tsx"),
  route(`${INDEXNOW_KEY}.txt`, "routes/indexnow-key.tsx"),
] satisfies RouteConfig;
