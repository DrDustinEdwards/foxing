import Link from 'next/link'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { monthLabel } from '@/lib/book-clubs'
import { createAdminClient } from '@/lib/supabase/admin'
import { PickEditor } from './pick-editor'
import { MissingClubAdd } from './missing-club-add'
import { MonthTabs } from './month-tabs'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Celebrity picks, admin',
}

interface ClubRow {
  id: string
  slug: string
  name: string
  short_name: string
  curator: string | null
  sort_order: number | null
  is_active: boolean | null
}

interface PickRow {
  id: string
  club_id: string
  book_id: string
  pick_month: number | null
  pick_year: number | null
  is_published: boolean | null
  is_auto_discovered: boolean | null
  auto_source: string | null
  curator_quote: string | null
  official_announcement_url: string | null
  last_edited_at: string | null
  books: { id: string; title: string; author: string } | null
}

interface SearchParams {
  year?: string
  month?: string
}

function nowPair() {
  const d = new Date()
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

function parseTab(searchParams: SearchParams): { year: number; month: number } {
  const fallback = nowPair()
  const year = Number(searchParams.year)
  const month = Number(searchParams.month)
  const validYear = Number.isInteger(year) && year >= 2000 && year <= 2100
  const validMonth = Number.isInteger(month) && month >= 1 && month <= 12
  return {
    year: validYear ? year : fallback.year,
    month: validMonth ? month : fallback.month,
  }
}

export default async function AdminCelebrityPicksPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { year, month } = parseTab(searchParams)
  const admin = createAdminClient()

  const [{ data: clubRows }, { data: pickRows }] = await Promise.all([
    admin
      .from('external_book_clubs')
      .select('id, slug, name, short_name, curator, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    admin
      .from('external_book_club_picks')
      .select(
        'id, club_id, book_id, pick_month, pick_year, is_published, is_auto_discovered, auto_source, curator_quote, official_announcement_url, last_edited_at, books:book_id(id, title, author)',
      )
      .eq('pick_month', month)
      .eq('pick_year', year),
  ])

  const clubs = (clubRows as ClubRow[] | null) ?? []
  const picks = ((pickRows as unknown as PickRow[] | null) ?? []).filter(
    (p) => p.books !== null,
  )

  const byClubId = new Map<string, PickRow>()
  for (const p of picks) byClubId.set(p.club_id, p)

  const monthName = monthLabel(month)

  return (
    <div className="p-6 md:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-fraunces text-[2rem] text-text-primary">
            Celebrity picks
          </h1>
          <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
            {monthName} {year} · {picks.length} of {clubs.length} clubs have a
            pick
          </p>
        </div>
        <Link href="/admin/celebrity-picks/new">
          <Button variant="secondary" size="sm">
            New pick (custom date)
          </Button>
        </Link>
      </header>

      <MonthTabs current={{ year, month }} />

      {clubs.length === 0 ? (
        <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
          No active clubs to manage.
        </p>
      ) : (
        <section className="mt-8 flex flex-col gap-3">
          {clubs.map((club) => {
            const pick = byClubId.get(club.id)
            return pick ? (
              <PickRowItem key={club.id} club={club} pick={pick} />
            ) : (
              <MissingClubRow
                key={club.id}
                club={club}
                year={year}
                month={month}
              />
            )
          })}
        </section>
      )}
    </div>
  )
}

function PickRowItem({ club, pick }: { club: ClubRow; pick: PickRow }) {
  const sourceLabel =
    pick.auto_source === 'manual' || !pick.is_auto_discovered
      ? 'Manual'
      : pick.auto_source
        ? `Auto, ${pick.auto_source}`
        : 'Auto'
  const sourceVariant: 'brand' | 'info' | 'neutral' =
    pick.auto_source === 'manual' || !pick.is_auto_discovered
      ? 'brand'
      : pick.auto_source === 'web_search'
        ? 'info'
        : 'neutral'
  return (
    <article className="rounded-lg border border-border-subtle bg-bg-surface p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            {club.name}
          </p>
          <p className="font-fraunces text-base text-text-primary">
            {pick.books?.title}
          </p>
          <p className="font-dm-sans text-sm text-text-tertiary">
            {pick.books?.author}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={sourceVariant}>{sourceLabel}</Badge>
          {!pick.is_published && <Badge variant="warning">Draft</Badge>}
        </div>
      </header>
      <PickEditor
        pickId={pick.id}
        initial={{
          book_title: pick.books?.title ?? '',
          book_author: pick.books?.author ?? '',
          curator_quote: pick.curator_quote ?? '',
          official_announcement_url: pick.official_announcement_url ?? '',
        }}
      />
    </article>
  )
}

function MissingClubRow({
  club,
  year,
  month,
}: {
  club: ClubRow
  year: number
  month: number
}) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-dashed border-border-default bg-bg-sunken p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            {club.name}
          </p>
          {club.curator && (
            <p className="font-dm-sans text-xs text-text-tertiary">
              {club.curator}
            </p>
          )}
        </div>
        <Badge variant="neutral">Missing</Badge>
      </header>
      <MissingClubAdd
        clubId={club.id}
        clubName={club.name}
        year={year}
        month={month}
      />
    </article>
  )
}
