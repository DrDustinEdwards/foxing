import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("signup", "routes/signup.tsx"),
  route("login", "routes/login.tsx"),
  route("onboarding", "routes/onboarding.tsx"),
  route("me", "routes/me.tsx"),

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
  route("journal/:slug", "routes/journal-post.tsx"),
  route("journal/rss.xml", "routes/journal-rss.tsx"),
  route("search", "routes/search.tsx"),
  route("search/suggest", "routes/search-suggest.tsx"),

  // SEO + share surfaces.
  route("og/book/:slug", "routes/og-book.tsx"),
  route("sitemap.xml", "routes/sitemap.tsx"),
  route("robots.txt", "routes/robots.tsx"),
] satisfies RouteConfig;
