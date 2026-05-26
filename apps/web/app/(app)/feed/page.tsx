import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { formatRelativeDate } from '@foxing/utils'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { StarRating } from '@/components/ui/star-rating'
import { getAuthedUserId } from '@/lib/nav-user'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Following feed · Foxing',
  robots: { index: false, follow: false },
}

interface FeedActor {
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

type FeedEvent =
  | {
      kind: 'finished'
      id: string
      event_time: string
      actor: FeedActor
      book: FeedBook
      rating: number | null
      review: string | null
    }
  | {
      kind: 'highlighted'
      id: string
      event_time: string
      actor: FeedActor
      book: FeedBook
      text: string
    }

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

  const finishedSince = new Date(
    Date.now() - 30 * 86_400_000,
  ).toISOString()
  const highlightSince = new Date(
    Date.now() - 7 * 86_400_000,
  ).toISOString()

  const [finishedRes, highlightsRes] = await Promise.all([
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
      .limit(30),
    sb
      .from('highlights')
      .select(
        'id, text, created_at, profiles:user_id(username, display_name, avatar_url, is_public), books:book_id(id, slug, title, author, cover_url)',
      )
      .in('user_id', followingIds)
      .eq('is_public', true)
      .gte('created_at', highlightSince)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const events: FeedEvent[] = []
  for (const row of (finishedRes.data ?? []) as unknown as Array<{
    id: string
    rating: number | null
    review: string | null
    finished_at: string
    profiles: (FeedActor & { is_public: boolean }) | null
    books: FeedBook | null
  }>) {
    if (!row.profiles?.is_public || !row.books) continue
    events.push({
      kind: 'finished',
      id: `f-${row.id}`,
      event_time: row.finished_at,
      actor: row.profiles,
      book: row.books,
      rating: row.rating,
      review: row.review,
    })
  }
  for (const row of (highlightsRes.data ?? []) as unknown as Array<{
    id: string
    text: string
    created_at: string
    profiles: (FeedActor & { is_public: boolean }) | null
    books: FeedBook | null
  }>) {
    if (!row.profiles?.is_public || !row.books) continue
    events.push({
      kind: 'highlighted',
      id: `h-${row.id}`,
      event_time: row.created_at,
      actor: row.profiles,
      book: row.books,
      text: row.text,
    })
  }
  events.sort(
    (a, b) =>
      new Date(b.event_time).getTime() - new Date(a.event_time).getTime(),
  )
  const recent = events.slice(0, 30)

  return (
    <PageWrapper className="py-10">
      <Header />
      {recent.length === 0 ? (
        <div className="mt-10">
          <EmptyState heading="No recent activity from people you follow." />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {recent.map((event) => (
            <FeedItem key={event.id} event={event} />
          ))}
        </ul>
      )}
    </PageWrapper>
  )
}

function Header() {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="font-fraunces text-[2rem] text-text-primary">Feed</h1>
      <p className="font-source-serif-4 text-base text-text-secondary">
        Books and passages from the readers you follow.
      </p>
    </header>
  )
}

function FeedItem({ event }: { event: FeedEvent }) {
  const bookHref = `/book/${event.book.slug ?? event.book.id}`
  return (
    <li className="flex gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <Link href={`/u/${event.actor.username}`} className="shrink-0">
        <Avatar
          src={event.actor.avatar_url}
          name={event.actor.display_name}
          size="md"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <Link
            href={`/u/${event.actor.username}`}
            className="font-dm-sans text-sm font-medium text-text-primary hover:text-brand-text"
          >
            {event.actor.display_name}
          </Link>
          <span className="font-dm-sans text-sm text-text-secondary">
            {event.kind === 'finished'
              ? 'finished'
              : 'saved a passage from'}
          </span>
          <Link
            href={bookHref}
            className="font-fraunces text-sm text-text-primary hover:text-brand-text"
          >
            {event.book.title}
          </Link>
          <time className="ml-auto font-dm-mono text-[11px] text-text-tertiary">
            {formatRelativeDate(event.event_time)}
          </time>
        </div>
        <div className="flex gap-3">
          <Link
            href={bookHref}
            className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-bg-sunken"
          >
            {event.book.cover_url && (
              <Image
                src={event.book.cover_url}
                alt={event.book.title}
                fill
                sizes="48px"
                className="object-cover"
              />
            )}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-dm-sans text-xs text-text-tertiary">
              {event.book.author}
            </p>
            {event.kind === 'finished' && typeof event.rating === 'number' && (
              <StarRating value={event.rating} size="sm" readOnly />
            )}
            {event.kind === 'finished' && event.review && (
              <p className="line-clamp-2 font-source-serif-4 text-sm text-text-secondary">
                {event.review}
              </p>
            )}
            {event.kind === 'highlighted' && (
              <blockquote className="font-source-serif-4 text-sm italic text-text-secondary">
                &ldquo;{event.text}&rdquo;
              </blockquote>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
