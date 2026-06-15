import Link from 'next/link'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
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
      <PageHeader
        title="New celebrity pick"
        subtitle="Pick a club, a book, and the month they featured it."
      />
      <div className="mt-6 rounded-lg border border-border-subtle bg-bg-surface p-5">
        <CelebrityPickForm
          clubs={clubs.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
        />
      </div>
    </div>
  )
}
