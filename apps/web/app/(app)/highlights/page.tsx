import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
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
      <PageHeader
        title="My highlights"
        subtitle={`${items.length.toLocaleString()} saved passages`}
        actions={
          <a href="/api/highlights/export" download>
            <Button variant="secondary" size="sm">
              Export TXT
            </Button>
          </a>
        }
      />

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
