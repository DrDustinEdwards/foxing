import { CONFIRM_PATH, SIGN_IN_PATH } from "@dustinedwards/site-runtime/sign-in-path";
import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

export default [
  index("routes/marketing.tsx"),
  route("signup", "routes/signup.tsx"),
  route(SIGN_IN_PATH.slice(1), "routes/login.tsx"),
  route(CONFIRM_PATH.slice(1), "routes/sign-in-confirm.tsx"),
  route("email/confirm", "routes/email-confirm.tsx"),

  route("u/:username", "routes/u-profile.tsx"),
  route("u/:username/recap/:year", "routes/recap.tsx"),
  route("lists/:id", "routes/list-detail.tsx"),

  // Chart demos with sample numbers: no sign-in, noindex, nothing read from D1, so a live check sees what a reader does.
  ...prefix("demos", [
    route("stats", "routes/demos/stats.tsx"),
    route("year", "routes/demos/year.tsx"),
    route("goals", "routes/demos/goals.tsx"),
  ]),

  route("guide", "routes/guide.tsx"),
  route("app-guide", "routes/app-guide.tsx"),

  route("books", "routes/books.tsx"),
  route("books/:slug", "routes/book-detail.tsx"),
  route("book/:slug", "routes/book-legacy.tsx"),
  route("authors/:slug", "routes/author.tsx"),
  route("awards", "routes/awards.tsx"),
  route("awards/:slug", "routes/award-detail.tsx"),
  route("picks", "routes/picks.tsx"),
  route("picks/:clubSlug", "routes/pick-club.tsx"),
  route("book-of-the-month", "routes/botm.tsx"),
  route("journal", "routes/journal.tsx"),
  route("journal/archive", "routes/journal-archive.tsx"),
  route("journal/tag/:tag", "routes/journal-tag.tsx"),
  route("journal/series/:series", "routes/journal-series.tsx"),
  route("journal/:slug", "routes/journal-post.tsx"),
  route("journal/rss.xml", "routes/journal-rss.tsx"),
  route("search", "routes/search.tsx"),

  route("read/:slug", "routes/read.tsx"),

  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  route("accessibility", "routes/accessibility.tsx"),
  route("about", "routes/about.tsx"),
  route("features", "routes/features.tsx"),

  route("og/site", "routes/og-site.tsx"),
  route("og/book/:slug", "routes/og-book.tsx"),
  route("og/recap/:username/:year", "routes/og-recap.tsx"),
  route("sitemap.xml", "routes/sitemap.tsx"),
  route("llms.txt", "routes/llms.tsx"),

  // Private pages: the layout's headers keep Cloudflare's Web Analytics beacon off them.
  layout("routes/private.tsx", [
    route("home", "routes/home.tsx"),
    route("onboarding", "routes/onboarding.tsx"),
    route("passkey", "routes/passkey-offer.tsx"),
    route("me", "routes/me.tsx"),
    route("settings", "routes/settings.tsx"),
    route("library", "routes/library.tsx"),
    route("shelves/:id", "routes/shelf-detail.tsx"),
    route("clubs", "routes/clubs.tsx"),
    route("clubs/new", "routes/club-new.tsx"),
    route("clubs/:slug", "routes/club-detail.tsx"),
    route("clubs/:slug/t/:threadId", "routes/club-thread.tsx"),
    route("join/:code", "routes/join-code.tsx"),
    route("feed", "routes/feed.tsx"),
    route("people", "routes/people.tsx"),
    route("diary/new", "routes/diary-new.tsx"),
    route("diary/:id/edit", "routes/diary-edit.tsx"),
    route("lists/new", "routes/list-new.tsx"),
    route("lists/:id/edit", "routes/list-edit.tsx"),
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
    // Admin: operator-only, gated on ADMIN_EMAIL and CO_OWNER_EMAILS in every loader.
    route("admin", "routes/admin.tsx"),
    route("admin/book-of-month", "routes/admin-botm.tsx"),
    route("admin/celebrity-picks", "routes/admin-picks.tsx"),
    route("admin/books", "routes/admin-books.tsx"),
    route("admin/clubs", "routes/admin-clubs.tsx"),
    route("admin/users", "routes/admin-users.tsx"),
    route("admin/users/:id", "routes/admin-user-detail.tsx"),
    route("admin/notifications", "routes/admin-notifications.tsx"),
    route("admin/content", "routes/admin-content.tsx"),
    route("admin/analytics", "routes/admin-analytics.tsx"),
  ]),

  route("health", "routes/health.ts"),

  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
