import Link from 'next/link'
import type { Metadata } from 'next'
import { PickForm } from '../pick-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'New pick, Book of the Month',
}

export default function AdminBookOfMonthNewPage() {
  return (
    <div className="p-6 md:p-10">
      <p className="mb-4 font-dm-sans text-sm">
        <Link href="/admin/book-of-month" className="text-brand-text hover:underline">
          ← All picks
        </Link>
      </p>
      <h1 className="font-fraunces text-[2rem] text-text-primary">New pick</h1>
      <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
        Choose a book, set the month, and write a short reason.
      </p>
      <div className="mt-6 rounded-lg border border-border-subtle bg-bg-surface p-5">
        <PickForm mode="create" />
      </div>
    </div>
  )
}
