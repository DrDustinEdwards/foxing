import Image from 'next/image'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { WhereToRead } from '@/components/where-to-read'
import { formatRelativeDate } from '@foxing/utils'
import { fetchAnnouncementsForClub } from '@/lib/club-announcements'
import { fetchUpcomingMeetings } from '@/lib/club-meetings'
import { fetchPollsForClub } from '@/lib/club-polls'
import { fetchDiscussionGuide } from '@/lib/discussion-guide'
import { fetchClubMembers, getClubRole, isClubMod } from '@/lib/club-membership'
import {
  fetchClubPostsPreview,
  fetchPublicClubById,
  fetchPublicClubBySlug,
  isUuid,
} from '@/lib/queries'
import { getAuthedUserId, getNavUser } from '@/lib/nav-user'
import { appClubDeeplink } from '@/lib/foxing'
import { buildClubMetadata } from '@/lib/metadata'
import { createAdminClient } from '@/lib/supabase/admin'
import { AnnouncementsSection } from './announcements-section'
import { MeetingsSection } from './meetings-section'
import { PollsSection } from './polls-section'
import { ThreadDiscussionPanel } from './thread-discussion-panel'
import { ClubSettingsPanel } from './club-settings-panel'
import { ModerationPanel } from './moderation-panel'
import { PostAnnouncementForm } from './post-announcement-form'
import { ScheduleSection } from './schedule-section'
import { VerifiedBookstoreHeader } from './verified-bookstore-header'
import { WaitlistButton } from './waitlist-button'

export const revalidate = 60

export async function generateStaticParams() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return []
  }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('clubs')
    .select('slug')
    .eq('visibility', 'public')
    .not('slug', 'is', null)
    .limit(500)
  return ((data as { slug: string }[] | null) ?? [])
    .filter((c) => Boolean(c.slug))
    .map((c) => ({ slug: c.slug }))
}

async function resolveClub(slugOrId: string) {
  let club = await fetchPublicClubBySlug(slugOrId)
  if (!club && isUuid(slugOrId)) {
    club = await fetchPublicClubById(slugOrId)
  }
  return club
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const club = await resolveClub(params.slug)
  if (!club) return { title: 'Club not found' }
  return buildClubMetadata({
    id: club.id,
    slug: club.slug,
    name: club.name,
    description: club.description,
    current_book_title: club.current_book?.title,
    current_book_author: club.current_book?.author,
    member_count: club.member_count,
  })
}

export default async function ClubPage({
  params,
}: {
  params: { slug: string }
}) {
  const [navUser, club, userId] = await Promise.all([
    getNavUser(),
    resolveClub(params.slug),
    getAuthedUserId(),
  ])
  if (!club) notFound()
  if (isUuid(params.slug) && club.slug && club.slug !== params.slug) {
    permanentRedirect(`/clubs/${club.slug}`)
  }
  const [posts, announcements, meetings, polls, role, discussionGuide] =
    await Promise.all([
      fetchClubPostsPreview(club.id, 3),
      fetchAnnouncementsForClub(club.id),
      fetchUpcomingMeetings(club.id, userId),
      fetchPollsForClub(club.id, userId),
      getClubRole(club.id, userId),
      club.current_book_id
        ? fetchDiscussionGuide(club.current_book_id)
        : Promise.resolve(null),
    ])
  const canModerate = isClubMod(role)
  const isMember = role !== null
  const members = canModerate ? await fetchClubMembers(club.id) : []
  const adminClient = createAdminClient()
  const { data: adminClubRow } = canModerate
    ? await adminClient
        .from('clubs')
        .select(
          'member_approval, max_members, reading_pace, chapters_per_week, genre_tags, discord_webhook_url',
        )
        .eq('id', club.id)
        .maybeSingle()
    : { data: null }
  const adminClubFields = (adminClubRow as {
    member_approval: boolean | null
    max_members: number | null
    reading_pace: string | null
    chapters_per_week: number | null
    genre_tags: string[] | null
    discord_webhook_url: string | null
  } | null) ?? null
  const discordConnected = Boolean(
    adminClubFields?.discord_webhook_url ?? null,
  )
  const { data: nonModDiscordRow } =
    isMember && !canModerate
      ? await adminClient
          .from('clubs')
          .select('discord_webhook_url')
          .eq('id', club.id)
          .maybeSingle()
      : { data: null }
  const memberSeesDiscordBadge =
    isMember &&
    (discordConnected ||
      Boolean(
        (nonModDiscordRow as { discord_webhook_url: string | null } | null)
          ?.discord_webhook_url,
      ))
  const showPending = canModerate && adminClubFields?.member_approval === true
  const { data: pendingRows } = showPending
    ? await adminClient
        .from('club_members')
        .select(
          'user_id, joined_at, profile:user_id(username, display_name, avatar_url)',
        )
        .eq('club_id', club.id)
        .eq('status', 'pending')
        .order('joined_at', { ascending: true })
    : { data: null }
  const pendingMembers = (
    (pendingRows as
      | Array<{
          user_id: string
          joined_at: string
          profile: {
            username: string
            display_name: string
            avatar_url: string | null
          } | null
        }>
      | null) ?? []
  )
    .filter((r) => r.profile)
    .map((r) => ({
      user_id: r.user_id,
      joined_at: r.joined_at,
      username: r.profile!.username,
      display_name: r.profile!.display_name,
      avatar_url: r.profile!.avatar_url,
    }))

  const { data: reportRows } = canModerate
    ? await adminClient
        .from('post_reports')
        .select(
          'id, post_id, reason, created_at, post:post_id(content, author_id, has_spoiler, thread:thread_id(club_id), author:author_id(display_name)), reporter:reporter_id(display_name)',
        )
        .eq('status', 'pending')
        .eq('post_type', 'club_post')
        .order('created_at', { ascending: true })
    : { data: null }
  type ReportRowShape = {
    id: string
    post_id: string
    reason: string
    created_at: string
    post: {
      content: string
      author_id: string
      has_spoiler: boolean | null
      thread: { club_id: string } | null
      author: { display_name: string } | null
    } | null
    reporter: { display_name: string } | null
  }
  const reports = ((reportRows as unknown as ReportRowShape[] | null) ?? [])
    .filter((r) => r.post && r.post.thread?.club_id === club.id)
    .map((r) => ({
      id: r.id,
      post_id: r.post_id,
      reason: r.reason,
      created_at: r.created_at,
      post: {
        content: r.post!.content,
        author_id: r.post!.author_id,
        author_name: r.post!.author?.display_name ?? 'Reader',
        has_spoiler: Boolean(r.post!.has_spoiler),
      },
      reporter_name: r.reporter?.display_name ?? 'Reader',
    }))

  const { data: scheduleRows } = isMember
    ? await adminClient
        .from('club_schedule')
        .select('id, chapter_name, unlock_date')
        .eq('club_id', club.id)
        .order('unlock_date', { ascending: true })
    : { data: null }
  const scheduleEntries =
    (scheduleRows as
      | Array<{ id: string; chapter_name: string; unlock_date: string }>
      | null) ?? []

  const { data: capacityRow } = await adminClient
    .from('clubs')
    .select('max_members')
    .eq('id', club.id)
    .maybeSingle()
  const maxMembers =
    (capacityRow as { max_members: number | null } | null)?.max_members ?? null
  const isFull =
    maxMembers !== null && (club.member_count ?? 0) >= maxMembers
  const { data: ownWaitlistRow } = userId
    ? await adminClient
        .from('club_waitlist')
        .select('user_id')
        .eq('club_id', club.id)
        .eq('user_id', userId)
        .maybeSingle()
    : { data: null }
  const isOnWaitlist = Boolean(ownWaitlistRow)
  const { count: waitlistCount } = canModerate
    ? await adminClient
        .from('club_waitlist')
        .select('user_id', { count: 'exact', head: true })
        .eq('club_id', club.id)
    : { count: 0 }

  const bookPath = club.current_book?.slug ?? club.current_book?.id

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-fraunces text-[2rem] text-text-primary">
                {club.name}
              </h1>
              {memberSeesDiscordBadge && (
                <span className="rounded-full bg-brand-subtle px-2.5 py-1 font-dm-mono text-[10px] uppercase tracking-wider text-brand-subtle-text">
                  Connected to Discord
                </span>
              )}
            </div>
            <p className="font-dm-sans text-sm text-text-tertiary">
              {club.member_count} members
            </p>
            {club.description && (
              <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
                {club.description}
              </p>
            )}
          </header>

          <VerifiedBookstoreHeader club={club} />

          <AnnouncementsSection
            clubId={club.id}
            announcements={announcements}
            canModerate={canModerate}
          />

          {canModerate && (
            <section className="mt-6">
              <PostAnnouncementForm
                clubId={club.id}
                defaultCity={club.bookstore_city}
                defaultState={club.bookstore_state}
                canPin
              />
            </section>
          )}

          <MeetingsSection
            clubId={club.id}
            clubSlug={club.slug ?? club.id}
            meetings={meetings}
            canModerate={canModerate}
            isMember={isMember}
            defaultCity={club.bookstore_city}
            defaultState={club.bookstore_state}
          />

          <PollsSection
            clubId={club.id}
            polls={polls}
            canModerate={canModerate}
            isMember={isMember}
          />

          {isMember && (
            <ScheduleSection
              clubId={club.id}
              entries={scheduleEntries}
              canManage={canModerate}
            />
          )}

          {club.current_book && club.current_book_id && (
            <ThreadDiscussionPanel
              bookId={club.current_book_id}
              bookSlug={club.current_book.slug}
              bookTitle={club.current_book.title}
              initialQuestions={discussionGuide?.questions ?? null}
              canGenerate={canModerate}
            />
          )}

          {club.current_book && bookPath && (
            <section className="mt-8 flex flex-col gap-5 rounded-lg border border-border-subtle bg-bg-surface p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start">
                <Link
                  href={`/book/${bookPath}`}
                  className="relative h-44 w-32 shrink-0 overflow-hidden rounded-md bg-bg-sunken"
                >
                  {club.current_book.cover_url && (
                    <Image
                      src={club.current_book.cover_url}
                      alt={club.current_book.title}
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                  )}
                </Link>
                <div className="flex flex-col gap-2">
                  <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                    Reading now
                  </p>
                  <Link
                    href={`/book/${bookPath}`}
                    className="font-fraunces text-xl text-text-primary hover:text-brand-text"
                  >
                    {club.current_book.title}
                  </Link>
                  <p className="font-dm-sans text-sm text-text-tertiary">
                    {club.current_book.author}
                  </p>
                </div>
              </div>
              {(club.current_book.source_type === 'community' ||
                !club.current_book.epub_url) && (
                <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
                  <p className="font-dm-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">
                    Get the book
                  </p>
                  <WhereToRead
                    variant="inline"
                    book={{
                      id: club.current_book.id,
                      title: club.current_book.title,
                      author: club.current_book.author,
                      isbn: club.current_book.isbn,
                      isbn13: club.current_book.isbn13,
                      amazon_url: club.current_book.amazon_url,
                      bookshop_url: club.current_book.bookshop_url,
                      source_type: club.current_book.source_type,
                      epub_url: club.current_book.epub_url,
                    }}
                  />
                  <p className="font-dm-sans text-xs text-text-tertiary">
                    All members read from the same edition.
                  </p>
                </div>
              )}
            </section>
          )}

          <section className="mt-10 flex flex-wrap items-center gap-3">
            {isMember ? null : isFull ? (
              userId ? (
                <WaitlistButton clubId={club.id} onWaitlist={isOnWaitlist} />
              ) : (
                <Link href="/sign-in">
                  <Button variant="primary" size="md">
                    Sign in to join waitlist
                  </Button>
                </Link>
              )
            ) : (
              <Link href={appClubDeeplink(club.id)}>
                <Button variant="primary" size="md">
                  Join this club
                </Button>
              </Link>
            )}
            {isFull && !isMember && (
              <p className="font-dm-mono text-xs text-text-tertiary">
                Club is full ({club.member_count} of {maxMembers}).
              </p>
            )}
            <Link href={appClubDeeplink(club.id)}>
              <Button variant="secondary" size="md">
                See all discussions in the app
              </Button>
            </Link>
          </section>

          {canModerate && (
            <ModerationPanel
              clubId={club.id}
              isAdmin={role === 'admin'}
              members={members.map((m) => ({
                user_id: m.user_id,
                role: m.role,
                status: m.status,
                muted_until: m.muted_until,
                banned_at: m.banned_at,
                username: m.profile?.username ?? '',
                display_name: m.profile?.display_name ?? '',
                avatar_url: m.profile?.avatar_url ?? null,
              }))}
              pending={pendingMembers}
              showPending={showPending}
              reports={reports}
              waitlistCount={waitlistCount ?? 0}
            />
          )}

          {role === 'admin' && (
            <ClubSettingsPanel
              club={{
                id: club.id,
                name: club.name,
                description: club.description,
                visibility: club.visibility,
                member_approval: adminClubFields?.member_approval ?? null,
                max_members: adminClubFields?.max_members ?? null,
                reading_pace: adminClubFields?.reading_pace ?? null,
                chapters_per_week: adminClubFields?.chapters_per_week ?? null,
                genre_tags: adminClubFields?.genre_tags ?? null,
                current_book_id: club.current_book_id,
                discord_webhook_url:
                  adminClubFields?.discord_webhook_url ?? null,
              }}
            />
          )}

          {posts.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                Recent discussion
              </h2>
              <div className="flex flex-col gap-4">
                {posts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/clubs/${club.slug}/threads/${p.thread_id}`}
                    className="block rounded-lg border border-border-subtle bg-bg-surface p-4 hover:bg-bg-hover"
                  >
                    <header className="flex items-center gap-2">
                      <Avatar
                        src={p.author?.avatar_url}
                        name={p.author?.display_name ?? 'Reader'}
                        size="sm"
                      />
                      <div className="flex flex-col leading-tight">
                        <span className="font-dm-sans text-sm text-text-primary">
                          {p.author?.display_name ?? 'Reader'}
                        </span>
                        <time className="font-dm-mono text-xs text-text-tertiary">
                          {formatRelativeDate(p.created_at)}
                        </time>
                      </div>
                    </header>
                    <p className="mt-3 line-clamp-4 font-source-serif-4 text-base text-text-secondary">
                      {p.content}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
