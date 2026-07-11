// Search filter bar: progressive disclosure (a Filters button reveals the panel) over
// the three facets backed by real catalog data (genre from subjects, era, length).
// URL-driven: every change navigates to /search with the param set, resetting page, so
// the loader re-runs and results are server-rendered. Mood/difficulty/language stay
// hidden until enrichment populates them.
import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useDismiss } from "~/components/nav/use-menu";
import { cn } from "~/lib/cn";

// Mirror core ERA_BUCKETS / LENGTH_BUCKETS locally so the client bundle stays out of
// the core query layer (same pattern as the Books nav era chips).
const ERAS = [
  { slug: "pre-1800", label: "Before 1800" },
  { slug: "1800-1849", label: "1800 to 1849" },
  { slug: "1850-1899", label: "1850 to 1899" },
  { slug: "1900-1949", label: "1900 to 1949" },
  { slug: "modern", label: "1950 and later" },
];
const LENGTHS = [
  { slug: "short", label: "Short, under 40k words" },
  { slug: "medium", label: "Medium, 40k to 120k" },
  { slug: "long", label: "Long, 120k and up" },
];

export type ActiveFilters = { genre?: string; era?: string; length?: string };

function labelFor(list: Array<{ slug: string; label: string }>, slug?: string) {
  return list.find((o) => o.slug === slug)?.label ?? slug ?? "";
}

export function FilterBar({
  genres,
  active,
}: {
  genres: Array<{ subject: string; count: number }>;
  active: ActiveFilters;
}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  function apply(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    navigate(`/search?${next.toString()}`);
  }

  function clearAll() {
    const q = params.get("q");
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  const chips = [
    active.genre ? { key: "genre", label: active.genre } : null,
    active.era ? { key: "era", label: labelFor(ERAS, active.era) } : null,
    active.length ? { key: "length", label: labelFor(LENGTHS, active.length) } : null,
  ].filter((c): c is { key: string; label: string } => c !== null);

  return (
    <div className="mt-6">
      <div ref={ref} className="relative inline-block">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 font-ui text-sm transition-colors",
            chips.length
              ? "border-border-interactive bg-brand-subtle text-brand-subtle-text"
              : "border-border-interactive text-secondary hover:bg-hover",
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 6h16M7 12h10M10 18h4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          Filters
          {chips.length ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-text px-1 font-mono text-[0.625rem] text-on-brand dark:text-[color:var(--section-charcoal)]">
              {chips.length}
            </span>
          ) : null}
        </button>

        {open ? (
          <div className="absolute left-0 top-12 z-40 w-[min(22rem,90vw)] rounded-hero border border-border-subtle bg-surface p-5 shadow-card-md">
            <fieldset className="mb-4">
              <legend className="mb-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
                Genre
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g) => {
                  const on = active.genre === g.subject;
                  return (
                    <button
                      key={g.subject}
                      type="button"
                      aria-pressed={on}
                      onClick={() => apply("genre", on ? null : g.subject)}
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 font-ui text-xs transition-colors",
                        on
                          ? "bg-brand-text text-on-brand dark:text-[color:var(--section-charcoal)]"
                          : "border border-border-subtle text-secondary hover:bg-hover",
                      )}
                    >
                      {g.subject}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="mb-4 block">
              <span className="mb-2 block font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
                Era
              </span>
              <select
                value={active.era ?? ""}
                onChange={(e) => apply("era", e.target.value || null)}
                className="w-full rounded-md border border-border-interactive bg-surface px-3 py-2 font-ui text-sm text-primary"
              >
                <option value="">Any era</option>
                {ERAS.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
                Length
              </span>
              <select
                value={active.length ?? ""}
                onChange={(e) => apply("length", e.target.value || null)}
                className="w-full rounded-md border border-border-interactive bg-surface px-3 py-2 font-ui text-sm text-primary"
              >
                <option value="">Any length</option>
                {LENGTHS.map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>

            {chips.length ? (
              <button
                type="button"
                onClick={clearAll}
                className="mt-4 font-ui text-sm text-brand-text hover:underline"
              >
                Clear all filters
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {chips.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => apply(c.key, null)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border-interactive bg-surface px-3 py-1 font-ui text-xs text-secondary hover:bg-hover"
              >
                {c.label}
                <span aria-hidden="true">×</span>
                <span className="sr-only">Remove filter</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
