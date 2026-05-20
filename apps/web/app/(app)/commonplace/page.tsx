import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PhotoQuoteButton } from '@/components/commonplace/photo-quote-button'
import { fetchUserCommonplace } from '@/lib/commonplace'
import { getAuthedUserId } from '@/lib/nav-user'
import { CommonplaceList } from './commonplace-list'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Commonplace Book · Foxing',
  robots: { index: false, follow: false },
}

export default async function CommonplacePage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const entries = await fetchUserCommonplace(userId)

  return (
    <PageWrapper className="py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-fraunces text-[2rem] text-text-primary">
            Commonplace Book
          </h1>
          <p className="mt-1 font-source-serif-4 text-base text-text-secondary">
            Your personal anthology of favorite passages.
          </p>
        </div>
        <PhotoQuoteButton variant="primary" />
      </header>
      <CommonplaceList
        entries={entries.map((e) => ({
          id: e.id,
          passage_text: e.passage_text,
          book_id: e.book_id,
          book_slug: e.book?.slug ?? null,
          book_title: e.book?.title ?? e.book_title,
          book_author: e.book?.author ?? null,
          note: e.note,
          is_public: e.is_public,
          created_at: e.created_at,
        }))}
      />
    </PageWrapper>
  )
}
