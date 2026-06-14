import Link from 'next/link'

interface SearchPaginationProps {
  basePath: string
  page: number
  totalPages: number
  searchParams: Record<string, string | string[] | undefined>
}

/**
 * Numbered, SEO-crawlable pagination shared by browse pages. Preserves all
 * current search/filter params and only swaps `page`.
 */
export function SearchPagination({
  basePath,
  page,
  totalPages,
  searchParams,
}: SearchPaginationProps) {
  if (totalPages <= 1) return null

  function hrefFor(target: number): string {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === 'page' || v == null) continue
      if (Array.isArray(v)) v.forEach((x) => sp.append(k, x))
      else sp.set(k, v)
    }
    if (target > 1) sp.set('page', String(target))
    const s = sp.toString()
    return s ? `${basePath}?${s}` : basePath
  }

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-between gap-3"
    >
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className="font-dm-sans text-sm text-brand-text hover:underline"
        >
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="font-dm-mono text-xs text-text-tertiary">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          className="font-dm-sans text-sm text-brand-text hover:underline"
        >
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
