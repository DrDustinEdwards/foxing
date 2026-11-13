import { views } from "@foxing/core";
import { pageHref, parsePage } from "capsomer/behavior/pagination";
import { Link } from "capsomer/react/link";
import { PageShell } from "~/components/page-shell";
import { SearchBox } from "~/components/search-box";
import { FilterBar } from "~/components/search/filter-bar";
import { GroupedResults } from "~/components/search/grouped-results";
import { Pager } from "~/components/pager";
import { Container, PageHeader } from "~/components/ui";
import { publicPageHeaders } from "@dustinedwards/site-runtime/edge-cache";
import { loaderBase } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/search";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = parsePage(url.searchParams.get("page"));
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
  return publicPageHeaders({ freshSeconds: 120, staleSeconds: 600 });
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
    return pageHref(
      "/search",
      { q, genre: filters.genre, era: filters.era, length: filters.length },
      page,
    );
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
            <Pager
              page={result.page}
              pageCount={result.pageCount}
              hrefFor={hrefFor}
              label="Result pages"
            />
          </>
        ) : (
          <p className="cap-text mt-8" data-tone="muted" data-face="ui">
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

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
