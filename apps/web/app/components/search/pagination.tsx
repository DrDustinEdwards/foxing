// Numbered prev/next pagination for query results. Crawlable links (rel prev/next)
// whose hrefs preserve the query and active filters via the caller's hrefFor.
import { Link } from "capsomer/react/link";

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
    <nav aria-label="Pagination" className="mt-12 justify-center row-4">
      {page > 1 ? (
        <Link to={hrefFor(page - 1)} rel="prev" className="cap-btn">
          Previous
        </Link>
      ) : null}
      <span className="ui">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link to={hrefFor(page + 1)} rel="next" className="cap-btn">
          Next
        </Link>
      ) : null}
    </nav>
  );
}
