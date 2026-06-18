import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { formatRelativeDate } from '@foxing/utils'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { StarRating } from '@/components/ui/star-rating'
import { getAuthedUserId } from '@/lib/nav-user'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Following feed · Foxing',
  robots: { index: false, follow: false },
}

interface Actor {
  username: string
  display_name: string
  avatar_url: string | null
}
interface FeedBook {
  id: string
  slug: string | null
  title: string
  author: string
  cover_url: string | null
}
interface BaseEntry {
  id: string
  time: string
  actor: Actor
}
type Entry =
  | (BaseEntry & {
      kind: 'finished'
      book: FeedBook
      rating: number | null
      review: string | null
    })
  | (BaseEntry & { kind: 'highlighted'; book: FeedBook; text: string })
  | (BaseEntry & { kind: 'started'; book: FeedBook })
  | (BaseEntry & { kind: 'rated'; book: FeedBook; rating: number | null })
  | (BaseEntry & { kind: 'reviewed'; book: FeedBook; review: string | null })
  | (BaseEntry & { kind: 'joined_club'; clubName: string; clubSlug: string | null })
  | (BaseEntry & { kind: 'milestone'; days: number | null })
  | (BaseEntry & { kind: 'goal'; goalYear: number | null })

type Grouped =
  | Entry
  | {
      kind: 'finished_group'
      id: string
      time: string
      actor: Actor
      books: FeedBook[]
    }

// activity types the events feed renders; finished_book + highlighted are
// covered by the richer derived queries below, so they're excluded here to
// avoid double-counting.
const ACTIVITY_TYPES = [
  'started_book',
  'rated_book',
  'reviewed_book',
  'joined_club',
  'hit_streak_milestone',
  'finished_goal',
]

export default async function FeedPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const sb = await createClient()

  const { data: follows } = await sb
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .limit(500)
  const followingIds = ((follows as { following_id: string }[] | null) ?? [])
    .map((f) => f.following_id)
    .filter(Boolean)

  if (followingIds.length === 0) {
    return (
      <PageWrapper className="py-10">
        <Header />
        <div className="mt-10">
          <EmptyState
            heading="Follow other readers to see their activity."
            action={
              <Link
                href="/people"
                className="font-dm-sans text-sm text-brand-text hover:underline"
              >
                Find readers
              </Link>
            }
          />
        </div>
      </PageWrapper>
    )
  }

  const finishedSince = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const highlightSince = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const activitySince = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [finishedRes, highlightsRes, activityRes] = await Promise.all([
    sb
      .from('user_books')
      .select(
        'id, rating, review, finished_at, profiles:user_id(username, display_name, avatar_url, is_public), books:book_id(id, slug, title, author, cover_url)',
      )
      .in('user_id', followingIds)
      .eq('status', 'finished')
      .not('finished_at', 'is', null)
      .gte('finished_at', finishedSince)
      .order('finished_at', { ascending: false })
      .limit(40),
    sb
      .from('highlights')
      .select(
        'id, text, created_at, user_id, books:book_id(id, slug, title, author, cover_url)',
      )
      .in('user_id', followingIds)
      .eq('is_public', true)
      .gte('created_at', highlightSince)
      .order('created_at', { ascending: false })
      .limit(30),
    // RLS already hides private/non-followed events; we still scope to people
    // the viewer follows so the feed is "your following," not all public events.
    sb
      .from('activity_events')
      .select('id, user_id, type, book_id, target_id, data, created_at')
      .in('user_id', followingIds)
      .in('type', ACTIVITY_TYPES)
      .gte('created_at', activitySince)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const entries: Entry[] = []

  for (const row of (finishedRes.data ?? []) as unknown as Array<{
    id: string
    rating: number | null
    review: string | null
    finished_at: string
    profiles: (Actor & { is_public: boolean }) | null
    books: FeedBook | null
  }>) {
    if (!row.profiles?.is_public || !row.books) continue
    entries.push({
      kind: 'finished',
      id: `f-${row.id}`,
      time: row.finished_at,
      actor: row.profiles,
      book: row.books,
      rating: row.rating,
      review: row.review,
    })
  }

  const highlightRows = (highlightsRes.data ?? []) as unknown as Array<{
    id: string
    text: string
    created_at: string
    user_id: string
    books: FeedBook | null
  }>
  // highlights.user_id FKs auth.users, not profiles, so the actor profile is
  // fetched separately rather than embedded.
  const highlightActorsById = new Map<string, Actor & { is_public: boolean }>()
  if (highlightRows.length > 0) {
    const { data: hlActors } = await sb
      .from('profiles')
      .select('id, username, display_name, avatar_url, is_public')
      .in('id', [...new Set(highlightRows.map((r) => r.user_id))])
    for (const a of (hlActors as Array<Actor & { id: string; is_public: boolean }> | null) ?? []) {
      highlightActorsById.set(a.id, a)
    }
  }
  for (const row of highlightRows) {
    const actor = highlightActorsById.get(row.user_id)
    if (!actor || !actor.is_public || !row.books) continue
    entries.push({
      kind: 'highlighted',
      id: `h-${row.id}`,
      time: row.created_at,
      actor,
      book: row.books,
      text: row.text,
    })
  }

  // Enrich activity_events: actors, books, clubs are fetched separately because
  // activity_events FKs user_id to auth.users (no PostgREST embed to profiles).
  const activityRows =
    (activityRes.data as
      | Array<{
          id: string
          user_id: string
          type: string
          book_id: string | null
          target_id: string | null
          data: Record<string, unknown> | null
          created_at: string
        }>
      | null) ?? []
  if (activityRows.length > 0) {
    const actorIds = [...new Set(activityRows.map((r) => r.user_id))]
    const bookIds = [...new Set(activityRows.map((r) => r.book_id).filter(Boolean))] as string[]
    const clubIds = [
      ...new Set(
        activityRows
          .filter((r) => r.type === 'joined_club')
          .map((r) => r.target_id)
          .filter(Boolean),
      ),
    ] as string[]

    const [actorsRes, booksRes, clubsRes] = await Promise.all([
      sb
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_public')
        .in('id', actorIds),
      bookIds.length > 0
        ? sb.from('books').select('id, slug, title, author, cover_url').in('id', bookIds)
        : Promise.resolve({ data: [] }),
      clubIds.length > 0
        ? sb.from('clubs').select('id, slug, name').in('id', clubIds)
        : Promise.resolve({ data: [] }),
    ])

    const actorsById = new Map(
      ((actorsRes.data as
        | Array<Actor & { id: string; is_public: boolean }>
        | null) ?? []).map((a) => [a.id, a]),
    )
    const booksById = new Map(
      ((booksRes.data as FeedBook[] | null) ?? []).map((b) => [b.id, b]),
    )
    const clubsById = new Map(
      ((clubsRes.data as { id: string; slug: string | null; name: string }[] | null) ?? []).map(
        (c) => [c.id, c],
      ),
    )

    for (const row of activityRows) {
      const actor = actorsById.get(row.user_id)
      if (!actor || !actor.is_public) continue
      const data = row.data ?? {}
      const base = { id: `a-${row.id}`, time: row.created_at, actor }
      if (row.type === 'joined_club') {
        const club = row.target_id ? clubsById.get(row.target_id) : undefined
        const slug =
          (typeof data.club_slug === 'string' ? data.club_slug : null) ??
          club?.slug ??
          null
        if (!club && !slug) continue
        entries.push({ ...base, kind: 'joined_club', clubName: club?.name ?? 'a club', clubSlug: slug })
        continue
      }
      if (row.type === 'hit_streak_milestone') {
        const days =
          typeof data.days === 'number'
            ? data.days
            : typeof data.milestone === 'number'
              ? data.milestone
              : null
        entries.push({ ...base, kind: 'milestone', days })
        continue
      }
      if (row.type === 'finished_goal') {
        const goalYear = typeof data.year === 'number' ? data.year : null
        entries.push({ ...base, kind: 'goal', goalYear })
        continue
      }
      // Book-centric activity types.
      const book = row.book_id ? booksById.get(row.book_id) : undefined
      if (!book) continue
      if (row.type === 'started_book') {
        entries.push({ ...base, kind: 'started', book })
      } else if (row.type === 'rated_book') {
        entries.push({
          ...base,
          kind: 'rated',
          book,
          rating: typeof data.rating === 'number' ? data.rating : null,
        })
      } else if (row.type === 'reviewed_book') {
        entries.push({
          ...base,
          kind: 'reviewed',
          book,
          review: typeof data.review === 'string' ? data.review : null,
        })
      }
    }
  }

  entries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  // Group consecutive "finished" by the same actor into one card.
  const grouped: Grouped[] = []
  for (const entry of entries) {
    const last = grouped[grouped.length - 1]
    if (entry.kind === 'finished') {
      if (
        last &&
        last.kind === 'finished_group' &&
        last.actor.username === entry.actor.username
      ) {
        last.books.push(entry.book)
        continue
      }
      if (
        last &&
        last.kind === 'finished' &&
        last.actor.username === entry.actor.username
      ) {
        grouped[grouped.length - 1] = {
          kind: 'finished_group',
          id: last.id,
          time: last.time,
          actor: last.actor,
          books: [last.book, entry.book],
        }
        continue
      }
    }
    grouped.push(entry)
  }
  const recent = grouped.slice(0, 40)

  return (
    <PageWrapper className="py-10">
      <Header />
      {recent.length === 0 ? (
        <div className="mt-10">
          <EmptyState heading="No recent activity from people you follow." />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {recent.map((entry) => (
            <FeedItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </PageWrapper>
  )
}

function Header() {
  return (
    <PageHeader
      title="Feed"
      subtitle="Books, passages, and milestones from the readers you follow."
      subtitleVariant="description"
    />
  )
}

function Shell({
  actor,
  time,
  children,
}: {
  actor: Actor
  time: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <Link href={`/u/${actor.username}`} className="shrink-0">
        <Avatar src={actor.avatar_url} name={actor.display_name} size="md" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          {children}
          <time className="ml-auto font-dm-mono text-[0.6875rem] text-text-tertiary">
            {formatRelativeDate(time)}
          </time>
        </div>
      </div>
    </li>
  )
}

function ActorLink({ actor }: { actor: Actor }) {
  return (
    <Link
      href={`/u/${actor.username}`}
      className="font-dm-sans text-sm font-medium text-text-primary hover:text-brand-text"
    >
      {actor.display_name}
    </Link>
  )
}

function BookLink({ book }: { book: FeedBook }) {
  return (
    <Link
      href={`/book/${book.slug ?? book.id}`}
      className="font-fraunces text-sm text-text-primary hover:text-brand-text"
    >
      {book.title}
    </Link>
  )
}

function Cover({ book }: { book: FeedBook }) {
  return (
    <Link
      href={`/book/${book.slug ?? book.id}`}
      className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-bg-sunken"
    >
      {book.cover_url && (
        <Image
          src={book.cover_url}
          alt={book.title}
          fill
          sizes="48px"
          className="object-cover"
        />
      )}
    </Link>
  )
}

function FeedItem({ entry }: { entry: Grouped }) {
  if (entry.kind === 'finished_group') {
    return (
      <Shell actor={entry.actor} time={entry.time}>
        <ActorLink actor={entry.actor} />
        <span className="font-dm-sans text-sm text-text-secondary">
          finished {entry.books.length} books
        </span>
        <div className="mt-1 flex w-full gap-2">
          {entry.books.slice(0, 6).map((b) => (
            <Cover key={b.id} book={b} />
          ))}
        </div>
      </Shell>
    )
  }

  if (
    entry.kind === 'finished' ||
    entry.kind === 'highlighted' ||
    entry.kind === 'started' ||
    entry.kind === 'rated' ||
    entry.kind === 'reviewed'
  ) {
    const verb =
      entry.kind === 'finished'
        ? 'finished'
        : entry.kind === 'highlighted'
          ? 'saved a passage from'
          : entry.kind === 'started'
            ? 'started reading'
            : entry.kind === 'rated'
              ? 'rated'
              : 'reviewed'
    return (
      <Shell actor={entry.actor} time={entry.time}>
        <ActorLink actor={entry.actor} />
        <span className="font-dm-sans text-sm text-text-secondary">{verb}</span>
        <BookLink book={entry.book} />
        <div className="mt-1 flex w-full gap-3">
          <Cover book={entry.book} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-dm-sans text-xs text-text-tertiary">
              {entry.book.author}
            </p>
            {entry.kind === 'finished' && typeof entry.rating === 'number' && (
              <StarRating value={entry.rating} size="sm" readOnly />
            )}
            {entry.kind === 'rated' && typeof entry.rating === 'number' && (
              <StarRating value={entry.rating} size="sm" readOnly />
            )}
            {entry.kind === 'finished' && entry.review && (
              <p className="line-clamp-2 font-source-serif-4 text-sm text-text-secondary">
                {entry.review}
              </p>
            )}
            {entry.kind === 'reviewed' && entry.review && (
              <p className="line-clamp-2 font-source-serif-4 text-sm text-text-secondary">
                {entry.review}
              </p>
            )}
            {entry.kind === 'highlighted' && (
              <blockquote className="font-source-serif-4 text-sm italic text-text-secondary">
                &ldquo;{entry.text}&rdquo;
              </blockquote>
            )}
          </div>
        </div>
      </Shell>
    )
  }

  if (entry.kind === 'joined_club') {
    return (
      <Shell actor={entry.actor} time={entry.time}>
        <ActorLink actor={entry.actor} />
        <span className="font-dm-sans text-sm text-text-secondary">joined</span>
        {entry.clubSlug ? (
          <Link
            href={`/clubs/${entry.clubSlug}`}
            className="font-fraunces text-sm text-text-primary hover:text-brand-text"
          >
            {entry.clubName}
          </Link>
        ) : (
          <span className="font-fraunces text-sm text-text-primary">
            {entry.clubName}
          </span>
        )}
      </Shell>
    )
  }

  if (entry.kind === 'milestone') {
    return (
      <Shell actor={entry.actor} time={entry.time}>
        <ActorLink actor={entry.actor} />
        <span className="font-dm-sans text-sm text-text-secondary">
          {entry.days
            ? `hit a ${entry.days}-day reading streak`
            : 'hit a reading streak milestone'}
        </span>
      </Shell>
    )
  }

  // goal
  return (
    <Shell actor={entry.actor} time={entry.time}>
      <ActorLink actor={entry.actor} />
      <span className="font-dm-sans text-sm text-text-secondary">
        reached their {entry.goalYear ? `${entry.goalYear} ` : ''}reading goal
      </span>
    </Shell>
  )
}
