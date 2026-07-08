import { catalogRepo } from "@foxing/core";
import { Link } from "react-router";
import { BookCard, BookGrid } from "~/components/book-card";
import { PageShell } from "~/components/page-shell";
import { SearchBox } from "~/components/search-box";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { loaderBase } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/search";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { db, origin } = loaderBase(context, request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const result = q ? await catalogRepo.searchCatalog(db, q, { page }) : null;
  return { origin, q, result };
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
    origin: data?.origin ?? "",
    pathname: location.pathname,
    noindex: true,
  });
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { q, result } = loaderData;

  return (
    <PageShell>
      <Container className="max-w-4xl">
        <PageHeader eyebrow="Find your next read" title="Search" />
        <SearchBox initialQuery={q} />

        {result ? (
          <div className="mt-10">
            {result.total === 0 ? (
              <EmptyState
                title={`Nothing found for "${q}"`}
                body="Try an author's last name, or a word from the title."
              />
            ) : (
              <>
                <p className="mb-6 font-ui text-sm text-tertiary">
                  {result.fuzzy ? (
                    <>
                      No exact match for <span className="text-secondary">&ldquo;{q}&rdquo;</span>.
                      Showing the closest results.
                    </>
                  ) : (
                    <>
                      {result.total.toLocaleString()} {result.total === 1 ? "result" : "results"}{" "}
                      for <span className="text-secondary">&ldquo;{q}&rdquo;</span>.
                    </>
                  )}
                </p>
                <BookGrid>
                  {result.books.map((b, i) => (
                    <BookCard key={b.slug} book={b} priority={i < 6} />
                  ))}
                </BookGrid>
                {result.pageCount > 1 ? (
                  <nav
                    aria-label="Pagination"
                    className="mt-12 flex items-center justify-center gap-4"
                  >
                    {result.page > 1 ? (
                      <Link
                        to={`/search?q=${encodeURIComponent(q)}&page=${result.page - 1}`}
                        rel="prev"
                        className="rounded-cover border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover"
                      >
                        Previous
                      </Link>
                    ) : null}
                    <span className="font-ui text-sm text-secondary">
                      Page {result.page} of {result.pageCount}
                    </span>
                    {result.page < result.pageCount ? (
                      <Link
                        to={`/search?q=${encodeURIComponent(q)}&page=${result.page + 1}`}
                        rel="next"
                        className="rounded-cover border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover"
                      >
                        Next
                      </Link>
                    ) : null}
                  </nav>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <p className="mt-8 font-ui text-secondary">
            Start typing to search, or{" "}
            <Link to="/books" className="text-brand-text hover:underline">
              browse the whole library
            </Link>
            .
          </p>
        )}
      </Container>
    </PageShell>
  );
}
