import { catalogRepo } from "@foxing/core";
import { Link } from "react-router";
import { BookCard, BookGrid } from "~/components/book-card";
import { PageShell } from "~/components/page-shell";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cn } from "~/lib/cn";
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

function parseFilters(url: URL): Filters {
  const p = url.searchParams;
  const sort = p.get("sort");
  return {
    subject: p.get("subject") || undefined,
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
  const { db, origin } = loaderBase(context, request);
  const filters = parseFilters(new URL(request.url));
  const [result, genres] = await Promise.all([
    catalogRepo.listBooks(db, filters),
    catalogRepo.getGenreFacets(db, 18),
  ]);
  return { origin, filters, result, genres };
}

export function headers(): HeadersInit {
  return publicCacheHeaders(1800, 86400);
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Books | Foxing" }];
  const label = data.filters.subject
    ? `${data.filters.subject[0].toUpperCase()}${data.filters.subject.slice(1)} books`
    : "Browse the library";
  return [
    ...buildMeta({
      title: label,
      description: `Browse ${data.result.total.toLocaleString()} readable classics on Foxing. Filter by genre, era, and length.`,
      origin: data.origin,
      pathname: location.pathname,
    }),
    ldJson(
      itemListLd(
        data.origin,
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
    <Link
      to={to}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 font-ui text-sm transition-colors",
        active
          ? "border-border-interactive bg-brand-subtle text-brand-subtle-text"
          : "border-border-subtle text-secondary hover:bg-hover",
      )}
    >
      {children}
    </Link>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function Books({ loaderData }: Route.ComponentProps) {
  const { filters, result, genres } = loaderData;
  const hasFilters = !!(filters.subject || filters.era || filters.length);

  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="The library"
          title="Browse the books"
          lede={`${result.total.toLocaleString()} readable classics, free to read in Foxing.`}
        />

        {/* Filters: plain links, no client JS, fully cacheable. */}
        <div className="mb-10 flex flex-col gap-6 rounded-card border border-border-subtle bg-surface p-5">
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
                Sort
              </span>
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
            {hasFilters ? (
              <Link to="/books" className="font-ui text-sm text-brand-text hover:underline">
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
                <BookCard key={b.slug} book={b} priority={i < 6} />
              ))}
            </BookGrid>
            <Pagination filters={filters} result={result} query={query} />
          </>
        )}
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
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-4">
      {prev ? (
        <Link
          to={prev}
          rel="prev"
          className="rounded-cover border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover"
        >
          Previous
        </Link>
      ) : (
        <span className="rounded-cover border border-border-subtle px-4 py-2 font-ui text-sm text-tertiary">
          Previous
        </span>
      )}
      <span className="font-ui text-sm text-secondary">
        Page {result.page} of {result.pageCount}
      </span>
      {next ? (
        <Link
          to={next}
          rel="next"
          className="rounded-cover border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover"
        >
          Next
        </Link>
      ) : (
        <span className="rounded-cover border border-border-subtle px-4 py-2 font-ui text-sm text-tertiary">
          Next
        </span>
      )}
    </nav>
  );
}
