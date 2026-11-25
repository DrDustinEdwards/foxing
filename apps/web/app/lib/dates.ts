// The en-US date formats the routes share, built once. Intl.DateTimeFormat is costly to construct.

export const mediumDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export const mediumDateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatLongDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
