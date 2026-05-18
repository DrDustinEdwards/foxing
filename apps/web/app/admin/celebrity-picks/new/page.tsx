import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchAllClubsForAdmin } from '@/lib/book-clubs'
import { CelebrityPickForm } from './pick-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'New celebrity pick',
}

export default async function AdminCelebrityPicksNewPage() {
  const clubs = await fetchAllClubsForAdmin()

  return (
    <div className="p-6 md:p-10">
      <p className="mb-4 font-dm-sans text-sm">
        <Link
          href="/admin/celebrity-picks"
          className="text-brand-text hover:underline"
        >
          ← All celebrity picks
        </Link>
      </p>
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        New celebrity pick
      </h1>
      <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
        Pick a club, a book, and the month they featured it.
      </p>
      <div className="mt-6 rounded-lg border border-border-subtle bg-bg-surface p-5">
        <CelebrityPickForm
          clubs={clubs.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
        />
      </div>
    </div>
  )
}
