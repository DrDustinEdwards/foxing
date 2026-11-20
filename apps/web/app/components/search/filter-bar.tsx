// Search filters: Capsomer's FilterBar, a GET form on /search that applies as a reader picks (genre from subjects, era,
// length: the facets backed by real catalog data). Each change submits the form, which drops `page`, so the loader
// re-runs and results are server-rendered. The query rides along as a hidden field.
import { FilterBar as CapFilterBar } from "capsomer/react/filter-bar";
import { Link } from "capsomer/react/link";
import { Form } from "react-router";
import { BOOKS_ERAS } from "~/components/nav/header-panels";

// The eras are the header's list (nav/header-panels), which mirrors core ERA_BUCKETS; LENGTH_BUCKETS is mirrored here
// so the client bundle stays out of the core query layer.
const LENGTHS = [
  { slug: "short", label: "Short, under 40k words" },
  { slug: "medium", label: "Medium, 40k to 120k" },
  { slug: "long", label: "Long, 120k and up" },
];

export type ActiveFilters = { genre?: string; era?: string; length?: string };

function Facet({
  name,
  label,
  any,
  value,
  options,
}: {
  name: string;
  label: string;
  any: string;
  value?: string;
  options: Array<{ slug: string; label: string }>;
}) {
  return (
    <label className="cap-stack" data-gap="3">
      <span className="group-label">{label}</span>
      <span className="cap-select-wrap" data-native="">
        <select key={value ?? ""} name={name} defaultValue={value ?? ""} className="cap-select">
          <option value="">{any}</option>
          {options.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export function FilterBar({
  q,
  genres,
  active,
}: {
  q: string;
  genres: Array<{ subject: string; label: string; count: number }>;
  active: ActiveFilters;
}) {
  const filtered = Boolean(active.genre || active.era || active.length);
  return (
    <CapFilterBar
      label="Filter search results"
      Form={Form}
      action="/search"
      live
      clearHref={filtered ? (q ? `/search?q=${encodeURIComponent(q)}` : "/search") : null}
      renderLink={({ href, className, children }) => (
        <Link to={href} className={className}>
          {children}
        </Link>
      )}
    >
      <input type="hidden" name="q" value={q} />
      <Facet
        name="genre"
        label="Genre"
        any="Any genre"
        value={active.genre}
        options={genres.map((g) => ({ slug: g.subject, label: g.label }))}
      />
      <Facet name="era" label="Era" any="Any era" value={active.era} options={BOOKS_ERAS} />
      <Facet
        name="length"
        label="Length"
        any="Any length"
        value={active.length}
        options={LENGTHS}
      />
    </CapFilterBar>
  );
}
