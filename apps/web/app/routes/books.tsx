import { formatCount } from "@drdustinedwards/site-helpers/text";
import { catalogRepo, views } from "@foxing/core";
import { ButtonLink, Link } from "capsomer/react/link";
import { BookCard, BookGrid } from "~/components/book-card";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { publicPageHeaders } from "@dustinedwards/site-runtime/edge-cache";
import { loaderBase } from "~/lib/loader.server";
import { itemList, jsonLd } from "@drdustinedwards/site-helpers/schema";
import { SITE_ORIGIN } from "~/lib/origins";
import { buildMeta } from "~/lib/seo";
import "~/styles/books.css";
import type { Route } from "./+types/books";

type Filters = {
  subject?: string;
  era?: string;
  length?: string;
  sort?: "title" | "year-desc" | "year-asc";
  page: number;
};

export function parseFilters(url: URL): Filters {
  const p = url.searchParams;
  const sort = p.get("sort");
  return {
    // A genre from Foxing's list; an old link with a raw heading lands on the genre it maps to.
    subject: catalogRepo.toGenres([p.get("subject") ?? ""])[0],
    era: p.get("era") || undefined,
    length: p.get("length") || undefined,
    sort: sort === "year-desc" || sort === "year-asc" ? sort : "title",
    page: Math.max(1, Number(p.get("page")) || 1),
  };
}

/** Build a query string from the current filters plus an override (null clears a key). */
function query(filters: Filters, override: Partial<Record<string, string | null>>): string {
  const base: Record<string, string | undefined> = {
    subject: filters.subject,
    era: filters.era,
    length: filters.length,
    sort: filters.sort === "title" ? undefined : filters.sort,
    page: filters.page > 1 ? String(filters.page) : undefined,
  };
  for (const [k, v] of Object.entries(override)) base[k] = v ?? undefined;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `/books?${s}` : "/books";
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const filters = parseFilters(new URL(request.url));
  const { genres, ...result } = await views.browse(db, filters);
  return { filters, result, genres };
}

export const headers = () => publicPageHeaders({ freshSeconds: 1800, staleSeconds: 86400 });

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Books | Foxing" }];
  const label = data.filters.subject
    ? `${catalogRepo.genreLabel(data.filters.subject)} books`
    : "Browse the library";
  return [
    ...buildMeta({
      title: label,
      description: `Browse ${formatCount(data.result.total)} readable classics on Foxing. Filter by genre, era, and length.`,
      pathname: location.pathname,
      pageType: "CollectionPage",
    }),
    jsonLd(
      itemList(
        SITE_ORIGIN,
        label,
        data.result.books.map((b) => ({ name: b.title, path: `/books/${b.slug}` })),
      ),
    ),
  ];
}

function FacetLink({
  active,
  to,
  children,
}: {
  active: boolean;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link to={to} aria-current={active ? "true" : undefined} className="cap-chip">
      {children}
    </Link>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cap-stack" data-gap="3">
      <p className="fx-books-caps">{label}</p>
      <div className="cap-cluster" data-gap="3">
        {children}
      </div>
    </div>
  );
}

export default function Books({ loaderData }: Route.ComponentProps) {
  const { filters, result, genres } = loaderData;
  const anyFilterSet = !!(filters.subject || filters.era || filters.length);
  const activeLabels = [
    filters.subject ? catalogRepo.genreLabel(filters.subject) : null,
    catalogRepo.resolveEra(filters.era)?.label,
    catalogRepo.resolveLength(filters.length)?.label,
  ].filter((l): l is string => !!l);

  return (
    <PageShell>
      <Container>
        <PageHeader title="Browse the books" lede={`${formatCount(result.total)} books`} />

        <div className="cap-stack" data-gap="7">
          {/* Filters: plain links, no client JS, fully cacheable. A native disclosure, closed on a phone so the
              first books are on screen; from 40rem it is always open and its summary is hidden (styles/books.css). */}
          <details className="fx-books-filters">
            <summary>
              Filter and sort
              {activeLabels.length ? (
                <span className="cap-text" data-tone="dim" data-size="small">
                  {activeLabels.join(", ")}
                </span>
              ) : null}
            </summary>
            <div className="cap-card fx-books-card">
              <FacetGroup label="Genre">
                {genres.map((g) => (
                  <FacetLink
                    key={g.subject}
                    active={filters.subject === g.subject}
                    to={query(filters, {
                      subject: filters.subject === g.subject ? null : g.subject,
                      page: null,
                    })}
                  >
                    {g.label}
                  </FacetLink>
                ))}
              </FacetGroup>
              <FacetGroup label="Era">
                {catalogRepo.ERA_BUCKETS.map((b) => (
                  <FacetLink
                    key={b.slug}
                    active={filters.era === b.slug}
                    to={query(filters, { era: filters.era === b.slug ? null : b.slug, page: null })}
                  >
                    {b.label}
                  </FacetLink>
                ))}
              </FacetGroup>
              <FacetGroup label="Length">
                {catalogRepo.LENGTH_BUCKETS.map((b) => (
                  <FacetLink
                    key={b.slug}
                    active={filters.length === b.slug}
                    to={query(filters, {
                      length: filters.length === b.slug ? null : b.slug,
                      page: null,
                    })}
                  >
                    {b.label}
                  </FacetLink>
                ))}
              </FacetGroup>
              <div className="fx-books-row">
                <div className="cap-cluster" data-gap="3">
                  <span className="group-label">Sort</span>
                  {(
                    [
                      ["title", "A to Z"],
                      ["year-desc", "Newest"],
                      ["year-asc", "Oldest"],
                    ] as const
                  ).map(([value, label]) => (
                    <FacetLink
                      key={value}
                      active={(filters.sort ?? "title") === value}
                      to={query(filters, { sort: value === "title" ? null : value, page: null })}
                    >
                      {label}
                    </FacetLink>
                  ))}
                </div>
                {anyFilterSet ? (
                  <Link to="/books" className="cap-text link" data-size="small" data-face="ui">
                    Clear filters
                  </Link>
                ) : null}
              </div>
            </div>
          </details>

          {result.books.length === 0 ? (
            <EmptyState title="No books match those filters" />
          ) : (
            <div className="cap-stack" data-gap="8">
              <BookGrid>
                {result.books.map((b, i) => (
                  <BookCard key={b.slug} book={b} position={i} headingLevel={2} />
                ))}
              </BookGrid>
              <Pagination filters={filters} result={result} query={query} />
            </div>
          )}
        </div>
      </Container>
    </PageShell>
  );
}

function Pagination({
  filters,
  result,
  query,
}: {
  filters: Filters;
  result: { page: number; pageCount: number };
  query: (f: Filters, o: Partial<Record<string, string | null>>) => string;
}) {
  if (result.pageCount <= 1) return null;
  const prev = result.page > 1 ? query(filters, { page: String(result.page - 1) }) : null;
  const next =
    result.page < result.pageCount ? query(filters, { page: String(result.page + 1) }) : null;
  return (
    <nav aria-label="Pagination" className="justify-center fx-books-row-2">
      {prev ? (
        <ButtonLink to={prev} rel="prev">
          Previous
        </ButtonLink>
      ) : (
        <span className="py-2 fx-books-label">Previous</span>
      )}
      <span className="cap-text" data-size="small" data-tone="muted" data-face="ui">
        Page {result.page} of {result.pageCount}
      </span>
      {next ? (
        <ButtonLink to={next} rel="next">
          Next
        </ButtonLink>
      ) : (
        <span className="py-2 fx-books-label">Next</span>
      )}
    </nav>
  );
}
