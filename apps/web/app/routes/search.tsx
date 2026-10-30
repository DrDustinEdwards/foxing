import { views } from "@foxing/core";
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { SearchBox } from "~/components/search-box";
import { FilterBar } from "~/components/search/filter-bar";
import { GroupedResults } from "~/components/search/grouped-results";
import { Pagination } from "~/components/search/pagination";
import { Container, PageHeader } from "~/components/ui";
import { loaderBase } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/search";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const filters = {
    genre: url.searchParams.get("genre") || undefined,
    era: url.searchParams.get("era") || undefined,
    length: url.searchParams.get("length") || undefined,
  };

  if (!q) return { q, filters, result: null, authors: [], genres: [] };
  const result = await views.search(db, q, {
    page,
    subject: filters.genre,
    era: filters.era,
    length: filters.length,
  });
  return { q, filters, result, authors: result.authors, genres: result.genres };
}

export function headers(): HeadersInit {
  // Query pages: cache briefly at the edge but keep them out of the index (meta).
  return { "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=600" };
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  const q = data?.q;
  return buildMeta({
    title: q ? `Search: ${q}` : "Search",
    description: "Search the Foxing catalog by title or author.",
    pathname: location.pathname,
    noindex: true,
  });
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { q, filters, result, authors, genres } = loaderData;

  function hrefFor(page: number) {
    const sp = new URLSearchParams();
    sp.set("q", q);
    if (filters.genre) sp.set("genre", filters.genre);
    if (filters.era) sp.set("era", filters.era);
    if (filters.length) sp.set("length", filters.length);
    if (page > 1) sp.set("page", String(page));
    return `/search?${sp.toString()}`;
  }

  return (
    <PageShell>
      <Container>
        <PageHeader eyebrow="Find your next read" title="Search" />
        <SearchBox initialQuery={q} />

        {result ? (
          <>
            <FilterBar genres={genres} active={filters} />
            <GroupedResults
              q={q}
              books={result.books}
              bookTotal={result.total}
              fuzzy={result.fuzzy}
              authors={authors}
            />
            <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
          </>
        ) : (
          <p className="mt-8 muted sans">
            Start typing to search, or{" "}
            <Link to="/books" className="link">
              browse the whole library
            </Link>
            .
          </p>
        )}
      </Container>
    </PageShell>
  );
}
