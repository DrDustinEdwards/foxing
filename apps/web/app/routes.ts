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

  // Social (Phase 6). Feed, people/close-friends, public profiles, diary, lists, recap.
  route("feed", "routes/feed.tsx"),
  route("people", "routes/people.tsx"),
  route("u/:username", "routes/u-profile.tsx"),
  route("u/:username/recap/:year", "routes/recap.tsx"),
  route("diary/new", "routes/diary-new.tsx"),
  route("diary/:id/edit", "routes/diary-edit.tsx"),
  route("lists/new", "routes/list-new.tsx"),
  route("lists/:id", "routes/list-detail.tsx"),
  route("lists/:id/edit", "routes/list-edit.tsx"),

  // Personal app surfaces (signed-in). Notifications, vocabulary, commonplace/highlights
  // aggregates, lists index, stats, diary index, goals, own year-in-reading. Gated
  // in-loader by requireProfile.
  route("notifications", "routes/notifications.tsx"),
  route("vocabulary", "routes/vocabulary.tsx"),
  route("commonplace", "routes/commonplace.tsx"),
  route("highlights", "routes/highlights.tsx"),
  route("lists", "routes/lists.tsx"),
  route("stats", "routes/stats.tsx"),
  route("diary", "routes/diary.tsx"),
  route("goals", "routes/goals.tsx"),
  route("year/:year?", "routes/year.tsx"),
  route("find-next-book", "routes/find-next-book.tsx"),

  // Admin (operator-only, gated on profiles.is_admin in every loader). Reads run
  // in-process via adminRepo; writes go to /api/v1/admin/* with an audit-log entry.
  route("admin", "routes/admin.tsx"),
  route("admin/book-of-month", "routes/admin-botm.tsx"),
  route("admin/celebrity-picks", "routes/admin-picks.tsx"),
  route("admin/books", "routes/admin-books.tsx"),
  route("admin/clubs", "routes/admin-clubs.tsx"),
  route("admin/users", "routes/admin-users.tsx"),
  route("admin/users/:id", "routes/admin-user-detail.tsx"),
  route("admin/journal", "routes/admin-journal.tsx"),
  route("admin/journal/new", "routes/admin-journal-new.tsx"),
  route("admin/journal/:id", "routes/admin-journal-edit.tsx"),
  route("admin/notifications", "routes/admin-notifications.tsx"),
  route("admin/content", "routes/admin-content.tsx"),
  route("admin/analytics", "routes/admin-analytics.tsx"),

  // Content pages (static, edge-cached).
  route("guide", "routes/guide.tsx"),
  route("app-guide", "routes/app-guide.tsx"),

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

  // Reader (client-only mount). Annotation + progress writes go to /api/v1 from the
  // browser; the loader reads existing annotations + saved position in-process.
  route("read/:slug", "routes/read.tsx"),

  // Legal + content (static, edge-cached).
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  route("about", "routes/about.tsx"),
  route("features", "routes/features.tsx"),

  // SEO + share surfaces.
  route("og/book/:slug", "routes/og-book.tsx"),
  route("og/recap/:username/:year", "routes/og-recap.tsx"),
  route("sitemap.xml", "routes/sitemap.tsx"),
  route("robots.txt", "routes/robots.tsx"),
  route(`${INDEXNOW_KEY}.txt`, "routes/indexnow-key.tsx"),
] satisfies RouteConfig;
