import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { fetchAllPicksForAdmin, monthLabel } from '@/lib/book-clubs'
import { DeletePickButton } from './delete-pick-button'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Celebrity picks, admin',
}

export default async function AdminCelebrityPicksPage() {
  const picks = await fetchAllPicksForAdmin()

  return (
    <div className="p-6 md:p-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-fraunces text-[2rem] text-text-primary">
            Celebrity picks
          </h1>
          <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
            {picks.length} pick{picks.length === 1 ? '' : 's'} on file
          </p>
        </div>
        <Link href="/admin/celebrity-picks/new">
          <Button variant="primary" size="md">
            New pick
          </Button>
        </Link>
      </header>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border-subtle bg-bg-surface">
        <table className="min-w-full text-left font-dm-sans text-sm">
          <thead className="border-b border-border-subtle bg-bg-sunken text-xs uppercase tracking-wide text-text-tertiary">
            <tr>
              <th className="px-3 py-2">Cover</th>
              <th className="px-3 py-2">Club</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Book</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {picks.map((pick) => (
              <tr key={pick.id} className="hover:bg-bg-hover">
                <td className="px-3 py-2">
                  <div className="relative h-14 w-10 overflow-hidden rounded bg-bg-sunken">
                    {pick.book.cover_url && (
                      <Image
                        src={pick.book.cover_url}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/book-clubs/${pick.club.slug}`}
                    className="text-brand-text hover:underline"
                  >
                    {pick.club.short_name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-text-tertiary">
                  {pick.pick_month && pick.pick_year
                    ? `${monthLabel(pick.pick_month)} ${pick.pick_year}`
                    : pick.picked_at.slice(0, 10)}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-text-primary">
                    {pick.book.title}
                  </div>
                  <div className="text-xs text-text-tertiary">
                    {pick.book.author}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {pick.is_published ? (
                    <span className="rounded-full bg-brand-subtle px-2 py-0.5 font-dm-mono text-xs text-brand-subtle-text">
                      Published
                    </span>
                  ) : (
                    <span className="rounded-full bg-bg-sunken px-2 py-0.5 font-dm-mono text-xs text-text-tertiary">
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <DeletePickButton id={pick.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {picks.length === 0 && (
          <p className="px-4 py-6 font-source-serif-4 text-sm text-text-tertiary">
            No picks yet. Add the first one.
          </p>
        )}
      </div>
    </div>
  )
}
