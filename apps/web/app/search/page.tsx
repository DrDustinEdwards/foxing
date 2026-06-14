import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { SearchBar } from '@/components/search-bar'
import { GroupedResultsView } from '@/components/search/grouped-results'
import { createClient } from '@/lib/supabase/server'
import { searchFederated } from '@/lib/search/query'
import type { SearchClient, SearchGroup } from '@/lib/search/types'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'

// Dynamic: queries run as the viewer (cookie client → RLS), so private clubs
// and profiles are excluded for anon and surfaced for their owner.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = STATIC_PAGE_METADATA['/search']

/** Per-entity browse pages a result group can "see all" of. */
const BROWSE_ROUTES: Partial<Record<SearchGroup['entity'], string>> = {
  book: '/books',
  person: '/people',
  club: '/clubs',
  list: '/lists',
  quote: '/quotes',
  journal: '/journal',
  pick: '/book-clubs',
}

export default async function SearchPage(props: {
  searchParams: Promise<{ q?: string }>
}) {
  const searchParams = await props.searchParams
  const q = (searchParams.q ?? '').trim()

  const supabase = await createClient()
  const results = q
    ? await searchFederated(supabase as unknown as SearchClient, {
        query: q,
        perEntityLimit: 12,
      })
    : { query: '', groups: [], total: 0 }

  function seeAllHref(group: SearchGroup): string | undefined {
    const base = BROWSE_ROUTES[group.entity]
    return base ? `${base}?q=${encodeURIComponent(q)}` : undefined
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <SearchBar defaultValue={q} />
          {q ? (
            <div className="mt-8">
              <GroupedResultsView
                results={results}
                seeAllHref={seeAllHref}
                emptyLabel={`Nothing matches “${q}”.`}
              />
            </div>
          ) : (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              Search books, authors, readers, clubs, lists, quotes, and more.
            </p>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
