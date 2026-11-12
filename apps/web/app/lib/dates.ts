// The en-US date formats the routes share, built once. Intl.DateTimeFormat is costly to construct.

/** "Jan 5, 2026". */
export const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

/** "Jan 5, 2026, 3:04 PM". */
export const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** "January 5, 2026", or null for no date (the Journal's post dates). */
export function formatLongDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
