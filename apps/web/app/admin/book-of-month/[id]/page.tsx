import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchPickByIdForAdmin, monthName } from '@/lib/botm'
import { PickForm } from '../pick-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Edit Book of the Month pick',
}

export default async function AdminBookOfMonthEditPage(
  props: {
    params: Promise<{ id: string }>
  }
) {
  const params = await props.params;
  const pick = await fetchPickByIdForAdmin(params.id)
  if (!pick) notFound()

  return (
    <div className="p-6 md:p-10">
      <p className="mb-4 font-dm-sans text-sm">
        <Link href="/admin/book-of-month" className="text-brand-text hover:underline">
          ← All picks
        </Link>
      </p>
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        {monthName(pick.month)} {pick.year}
      </h1>
      <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
        {pick.book.title} by {pick.book.author}
      </p>
      <div className="mt-6 rounded-lg border border-border-subtle bg-bg-surface p-5">
        <PickForm
          mode="edit"
          pickId={pick.id}
          initial={{
            book: {
              id: pick.book.id,
              title: pick.book.title,
              author: pick.book.author,
              cover_url: pick.book.cover_url,
              isbn: pick.book.isbn,
            },
            year: pick.year,
            month: pick.month,
            category: pick.category ?? 'fiction',
            curator_note: pick.curator_note,
            amazon_url: pick.amazon_url,
            bookshop_url: pick.bookshop_url,
            is_published: pick.is_published,
          }}
        />
      </div>
    </div>
  )
}
