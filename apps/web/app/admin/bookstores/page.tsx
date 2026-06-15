import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/page-header'
import { createAdminClient } from '@/lib/supabase/admin'
import { BookstoreRow } from './bookstore-row'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Bookstores, admin',
  robots: { index: false, follow: false },
}

interface ClubAdminRow {
  id: string
  slug: string | null
  name: string
  member_count: number
  club_type: 'reading' | 'bookstore' | null
  is_verified: boolean | null
  bookstore_address: string | null
  bookstore_city: string | null
  bookstore_state: string | null
  bookstore_zip: string | null
  bookstore_website: string | null
  bookstore_phone: string | null
  bookstore_hours: Record<string, string> | null
}

export default async function AdminBookstoresPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('clubs')
    .select(
      'id, slug, name, member_count, club_type, is_verified, bookstore_address, bookstore_city, bookstore_state, bookstore_zip, bookstore_website, bookstore_phone, bookstore_hours',
    )
    .or('club_type.eq.bookstore,is_verified.eq.true')
    .order('is_verified', { ascending: false })
    .order('name', { ascending: true })
  const stores = (data as ClubAdminRow[] | null) ?? []

  const ids = stores.map((s) => s.id)
  const eventCounts = new Map<string, number>()
  if (ids.length > 0) {
    const { data: counts } = await admin
      .from('club_announcements')
      .select('club_id')
      .in('club_id', ids)
      .not('event_date', 'is', null)
      .eq('is_removed', false)
    for (const row of (counts as { club_id: string }[] | null) ?? []) {
      eventCounts.set(row.club_id, (eventCounts.get(row.club_id) ?? 0) + 1)
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6">
        <PageHeader
          title="Bookstores"
          subtitle={`${stores.length} clubs marked as bookstore or verified.`}
        />
      </div>
      {stores.length === 0 ? (
        <p className="font-source-serif-4 text-base text-text-tertiary">
          No bookstores yet. Mark a club as bookstore and verify it from this
          page.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {stores.map((s) => (
            <BookstoreRow
              key={s.id}
              store={{
                id: s.id,
                slug: s.slug,
                name: s.name,
                member_count: s.member_count,
                club_type: s.club_type,
                is_verified: s.is_verified,
                bookstore_address: s.bookstore_address,
                bookstore_city: s.bookstore_city,
                bookstore_state: s.bookstore_state,
                bookstore_zip: s.bookstore_zip,
                bookstore_website: s.bookstore_website,
                bookstore_phone: s.bookstore_phone,
                bookstore_hours: s.bookstore_hours,
                event_count: eventCounts.get(s.id) ?? 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
