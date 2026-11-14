// The pages /sitemap.xml lists that no database row dates: the hubs and the pages written in code. The daily page-dates job
// (workers/app.ts) reads each as Markdown with Prelum's trackPageDates and keeps the day its text last changed in one KV key,
// and the sitemap reads it back. Each path has a Markdown copy (COPIED in workers/app.ts).
export const PAGE_DATES_KEY = "sitemap:page-dates";

export const TRACKED_PAGES = [
  "/",
  "/books",
  "/awards",
  "/picks",
  "/book-of-the-month",
  "/journal",
  "/journal/archive",
  "/about",
  "/accessibility",
  "/features",
  "/guide",
  "/app-guide",
  "/privacy",
  "/terms",
] as const;
