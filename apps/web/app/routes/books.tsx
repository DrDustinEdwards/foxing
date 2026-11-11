import { catalogRepo, views } from "@foxing/core";
import { pageHref, parsePage } from "capsomer/behavior/pagination";
import { Link } from "capsomer/react/link";
import { BookCard, BookGrid } from "~/components/book-card";
import { PageShell } from "~/components/page-shell";
import { Pager } from "~/components/pager";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { loaderBase, publicCacheHeaders } from "~/lib/loader.server";
import { buildMeta, itemListLd, ldJson } from "~/lib/seo";
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
    subject: p.get("subject") || undefined,
    era: p.get("era") || undefined,
    length: p.get("length") || undefined,
    sort: sort === "year-desc" || sort === "year-asc" ? sort : "title",
    page: parsePage(p.get("page")),
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

export const headers = () => publicCacheHeaders(1800, 86400);

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Books | Foxing" }];
  const label = data.filters.subject
    ? `${data.filters.subject[0].toUpperCase()}${data.filters.subject.slice(1)} books`
    : "Browse the library";
  return [
    ...buildMeta({
      title: label,
      description: `Browse ${data.result.total.toLocaleString()} readable classics on Foxing. Filter by genre, era, and length.`,
      pathname: location.pathname,
      pageType: "CollectionPage",
    }),
    ldJson(
      itemListLd(
        label,
        data.result.books.map((b) => ({ title: b.title, path: `/books/${b.slug}` })),
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
    <div>
      <p className="fx-books-caps">{label}</p>
      <div className="cap-cluster" data-gap="3">
        {children}
      </div>
    </div>
  );
}

export default function Books({ loaderData }: Route.ComponentProps) {
  const { filters, result, genres } = loaderData;
  const isFiltered = !!(filters.subject || filters.era || filters.length);

  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="The library"
          title="Browse the books"
          lede={`${result.total.toLocaleString()} readable classics, free to read in Foxing.`}
        />

        {/* Filters: plain links, no client JS, fully cacheable. */}
        <div className="mb-10 fx-books-card">
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
                {g.subject}
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
            {isFiltered ? (
              <Link to="/books" className="link sans small">
                Clear filters
              </Link>
            ) : null}
          </div>
        </div>

        {result.books.length === 0 ? (
          <EmptyState
            title="No books match those filters"
            body="Try removing a filter or browsing a different era."
          />
        ) : (
          <>
            <BookGrid>
              {result.books.map((b, i) => (
                <BookCard key={b.slug} book={b} position={i} headingLevel={2} />
              ))}
            </BookGrid>
            <Pager
              page={result.page}
              pageCount={result.pageCount}
              hrefFor={(n) =>
                pageHref(
                  "/books",
                  {
                    subject: filters.subject,
                    era: filters.era,
                    length: filters.length,
                    sort: filters.sort === "title" ? undefined : filters.sort,
                  },
                  n,
                )
              }
              label="Book pages"
            />
          </>
        )}
      </Container>
    </PageShell>
  );
}
