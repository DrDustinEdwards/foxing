import { Link } from "capsomer/react/link";
import { Pagination } from "capsomer/react/pagination";

export function Pager({
  page,
  pageCount,
  hrefFor,
  prevLabel,
  nextLabel,
  label,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  prevLabel?: string;
  nextLabel?: string;
  label?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <Pagination
      form="steps"
      page={page}
      pageCount={pageCount}
      hrefFor={hrefFor}
      prevLabel={prevLabel}
      nextLabel={nextLabel}
      label={label}
      renderLink={({ href, ...p }) => <Link to={href} {...p} />}
    />
  );
}
