// Numbered prev/next pagination for query results. Crawlable links (rel prev/next)
// whose hrefs preserve the query and active filters via the caller's hrefFor.
import { Link } from "react-router";

export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-4">
      {page > 1 ? (
        <Link
          to={hrefFor(page - 1)}
          rel="prev"
          className="rounded-cover border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover"
        >
          Previous
        </Link>
      ) : null}
      <span className="font-ui text-sm text-secondary">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link
          to={hrefFor(page + 1)}
          rel="next"
          className="rounded-cover border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover"
        >
          Next
        </Link>
      ) : null}
    </nav>
  );
}
