// Search filter bar: progressive disclosure (a Filters button reveals the panel) over
// the three facets backed by real catalog data (genre from subjects, era, length).
// URL-driven: every change navigates to /search with the param set, resetting page, so
// the loader re-runs and results are server-rendered. Mood/difficulty/language stay
// hidden until enrichment populates them. The panel is Capsomer's popover (the platform's
// popover: Esc and an outside click close it).
import { Popover, PopoverContent, PopoverTrigger } from "capsomer/react/popover";
import { useNavigate, useSearchParams } from "react-router";

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

  function apply(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    void navigate(`/search?${next.toString()}`);
  }

  function clearAll() {
    const q = params.get("q");
    void navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  const chips = [
    active.genre ? { key: "genre", label: active.genre } : null,
    active.era ? { key: "era", label: labelFor(ERAS, active.era) } : null,
    active.length ? { key: "length", label: labelFor(LENGTHS, active.length) } : null,
  ].filter((c): c is { key: string; label: string } => c !== null);

  return (
    <div className="mt-6">
      <Popover>
        <PopoverTrigger className="cap-btn fx-filter-btn" data-on={chips.length ? "" : undefined}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 6h16M7 12h10M10 18h4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          Filters
          {chips.length ? <span className="fx-filter-count">{chips.length}</span> : null}
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          aria-label="Filters"
          className="fx-filter-panel"
        >
          <div className="stack">
            <fieldset className="cap-chips">
              <legend className="group-label full">Genre</legend>
              {genres.map((g) => {
                const on = active.genre === g.subject;
                return (
                  <button
                    key={g.subject}
                    type="button"
                    className="cap-chip"
                    aria-pressed={on}
                    onClick={() => apply("genre", on ? null : g.subject)}
                  >
                    {g.subject}
                  </button>
                );
              })}
            </fieldset>

            <label className="block">
              <span className="group-label block mb-2">Era</span>
              <span className="cap-select-wrap" data-native="">
                <select
                  value={active.era ?? ""}
                  onChange={(e) => apply("era", e.target.value || null)}
                  className="cap-select"
                >
                  <option value="">Any era</option>
                  {ERAS.map((e) => (
                    <option key={e.slug} value={e.slug}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className="block">
              <span className="group-label block mb-2">Length</span>
              <span className="cap-select-wrap" data-native="">
                <select
                  value={active.length ?? ""}
                  onChange={(e) => apply("length", e.target.value || null)}
                  className="cap-select"
                >
                  <option value="">Any length</option>
                  {LENGTHS.map((l) => (
                    <option key={l.slug} value={l.slug}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            {chips.length ? (
              <button type="button" onClick={clearAll} className="cap-link-btn">
                Clear all filters
              </button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      {chips.length ? (
        <ul className="row-2 wrap mt-3">
          {chips.map((c) => (
            <li key={c.key}>
              <button type="button" onClick={() => apply(c.key, null)} className="cap-chip">
                {c.label}
                <span aria-hidden="true">×</span>
                <span className="cap-sr-only">Remove filter</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
