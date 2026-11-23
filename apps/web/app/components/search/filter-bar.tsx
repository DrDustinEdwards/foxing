// Search filters: Capsomer's FilterBar, a GET form on /search that applies as a reader picks (genre from subjects, era,
// length: the facets backed by real catalog data). Each change submits the form, which drops `page`, so the loader
// re-runs and results are server-rendered. The query rides along as a hidden field.
import { FilterBar as CapFilterBar } from "capsomer/react/filter-bar";
import { Link } from "capsomer/react/link";
import { NativeSelect } from "capsomer/react/select-native";
import { Form } from "react-router";
import { ERA_BUCKETS, LENGTH_BUCKETS } from "@foxing/core/catalog-buckets";

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
      <NativeSelect
        key={value ?? ""}
        name={name}
        defaultValue={value ?? ""}
        options={[
          { value: "", label: any },
          ...options.map((o) => ({ value: o.slug, label: o.label })),
        ]}
      />
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
      <Facet name="era" label="Era" any="Any era" value={active.era} options={ERA_BUCKETS} />
      <Facet
        name="length"
        label="Length"
        any="Any length"
        value={active.length}
        options={LENGTH_BUCKETS}
      />
    </CapFilterBar>
  );
}
