import Link from 'next/link'
import type { GroupedResults, SearchGroup } from '@/lib/search/types'
import { SearchResultItem } from './search-result-item'

/**
 * Shared grouped-results view: a header + count per entity group, then that
 * group's hits. Used by BOTH the /search page and the command palette so there
 * is one results presentation. `seeAllHref` lets a group link to its full
 * filtered page.
 */
interface GroupedResultsViewProps {
  results: GroupedResults
  /** Build a "see all" link for a group (e.g. /books?q=...). Optional. */
  seeAllHref?: (group: SearchGroup) => string | undefined
  emptyLabel?: string
}

export function GroupedResultsView({
  results,
  seeAllHref,
  emptyLabel = 'No results.',
}: GroupedResultsViewProps) {
  if (results.groups.length === 0) {
    return (
      <p className="py-10 text-center font-source-serif-4 text-sm text-text-tertiary">
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {results.groups.map((group) => {
        const href = seeAllHref?.(group)
        return (
          <section key={group.entity} aria-label={group.label}>
            <header className="mb-3 flex items-baseline justify-between">
              <h2 className="flex items-baseline gap-2 font-fraunces text-lg text-text-primary">
                {group.label}
                <span className="font-dm-mono text-xs text-text-tertiary">
                  {group.total}
                </span>
              </h2>
              {href && group.total > group.hits.length && (
                <Link
                  href={href}
                  className="font-dm-sans text-sm text-brand-text hover:underline"
                >
                  See all
                </Link>
              )}
            </header>
            <div className="flex flex-col gap-2">
              {group.hits.map((hit) => (
                <SearchResultItem key={`${hit.entity}:${hit.id}`} hit={hit} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
