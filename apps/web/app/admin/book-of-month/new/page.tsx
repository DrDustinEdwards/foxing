import Link from 'next/link'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { PickForm } from '../pick-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'New pick, Book of the Month',
}

interface SearchParams {
  book_id?: string
  title?: string
  author?: string
  cover_url?: string
  curator_note?: string
}

export default async function AdminBookOfMonthNewPage(
  props: {
    searchParams: Promise<SearchParams>
  }
) {
  const searchParams = await props.searchParams;
  const seeded =
    searchParams.book_id && searchParams.title && searchParams.author
      ? {
          book: {
            id: searchParams.book_id,
            title: searchParams.title,
            author: searchParams.author,
            cover_url: searchParams.cover_url ?? null,
            isbn: null,
          },
          curator_note: searchParams.curator_note ?? null,
        }
      : null

  return (
    <div className="p-6 md:p-10">
      <p className="mb-4 font-dm-sans text-sm">
        <Link href="/admin/book-of-month" className="text-brand-text hover:underline">
          ← All picks
        </Link>
      </p>
      <PageHeader
        title="New pick"
        subtitle="Choose a book, set the month, and write a short reason."
        subtitleVariant="description"
      />
      <div className="mt-6 rounded-lg border border-border-subtle bg-bg-surface p-5">
        <PickForm mode="create" prefill={seeded ?? undefined} />
      </div>
    </div>
  )
}
