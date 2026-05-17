import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchUserHighlights } from '@/lib/user-queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { HighlightsBrowser } from './highlights-browser'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My highlights · Foxing',
}

export default async function HighlightsPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const items = await fetchUserHighlights(userId)

  return (
    <PageWrapper className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-fraunces text-[2rem] text-text-primary">
            My highlights
          </h1>
          <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
            {items.length.toLocaleString()} saved passages
          </p>
        </div>
        <a href="/api/highlights/export" download>
          <Button variant="secondary" size="sm">
            Export TXT
          </Button>
        </a>
      </div>

      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            heading="No highlights yet."
            action={
              <span className="font-dm-sans text-sm text-text-tertiary">
                Long-press any passage in the Foxing app to save it.
              </span>
            }
          />
        </div>
      ) : (
        <HighlightsBrowser items={items} />
      )}
    </PageWrapper>
  )
}
