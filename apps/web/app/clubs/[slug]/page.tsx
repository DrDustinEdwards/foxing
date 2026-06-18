import { cache, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { WhereToRead } from '@/components/where-to-read'
import { fetchAnnouncementsForClub } from '@/lib/club-announcements'
import { fetchClubMeetings } from '@/lib/club-meetings'
import { fetchPollsForClub } from '@/lib/club-polls'
import { fetchDiscussionGuide } from '@/lib/discussion-guide'
import { fetchClubThreads } from '@/lib/club-threads'
import {
  fetchClubMembers,
  getClubMembershipStatus,
  getClubRole,
  isClubMod,
} from '@/lib/club-membership'
import { RequestJoinButton } from './request-join-button'
import {
  fetchPublicClubById,
  fetchPublicClubBySlug,
  isUuid,
} from '@/lib/queries'
import { getAuthedUserId } from '@/lib/nav-user'
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
import { DiscussionsSection } from './discussions-section'
import { MembersSection } from './members-section'
import { JoinClubButton } from './join-club-button'
import { ClubWorkspace, type ClubTabKey } from './club-workspace'

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

// cache() dedupes the club lookup across generateMetadata and the page render.
const resolveClub = cache(async (slugOrId: string) => {
  let club = await fetchPublicClubBySlug(slugOrId)
  if (!club && isUuid(slugOrId)) {
    club = await fetchPublicClubById(slugOrId)
  }
  return club
})

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
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

export default async function ClubPage(
  props: {
    params: Promise<{ slug: string }>
  }
) {
  const params = await props.params;
  const [club, userId] = await Promise.all([
    resolveClub(params.slug),
    getAuthedUserId(),
  ])
  if (!club) notFound()
  if (isUuid(params.slug) && club.slug && club.slug !== params.slug) {
    permanentRedirect(`/clubs/${club.slug}`)
  }
  const [threads, announcements, meetingData, polls, role, discussionGuide] =
    await Promise.all([
      fetchClubThreads(club.id),
      fetchAnnouncementsForClub(club.id),
      fetchClubMeetings(club.id, userId),
      fetchPollsForClub(club.id, userId),
      getClubRole(club.id, userId),
      club.current_book_id
        ? fetchDiscussionGuide(club.current_book_id)
        : Promise.resolve(null),
    ])
  const canModerate = isClubMod(role)
  const isMember = role !== null
  const adminClient = createAdminClient()
  // These reads only depend on club.id / userId / role, so run them in one
  // parallel batch; pendingMembers and membershipStatus depend on batch
  // results and stay sequential below.
  const [
    members,
    { data: adminClubRow },
    { data: nonModDiscordRow },
    { data: reportRows },
    { data: scheduleRows },
    { data: capacityRow },
    { data: ownWaitlistRow },
    { count: waitlistCount },
    { count: clubBookCount },
  ] = await Promise.all([
    fetchClubMembers(club.id),
    canModerate
      ? adminClient
          .from('clubs')
          .select(
            'member_approval, max_members, reading_pace, chapters_per_week, genre_tags, discord_webhook_url',
          )
          .eq('id', club.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isMember && !canModerate
      ? adminClient
          .from('clubs')
          .select('discord_webhook_url')
          .eq('id', club.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    canModerate
      ? adminClient
          .from('post_reports')
          .select(
            'id, post_id, reason, created_at, post:post_id(content, author_id, has_spoiler, thread:thread_id(club_id), author:author_id(display_name)), reporter:reporter_id(display_name)',
          )
          .eq('status', 'pending')
          .eq('post_type', 'club_post')
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: null }),
    adminClient
      .from('club_schedule')
      .select('id, chapter_name, unlock_date')
      .eq('club_id', club.id)
      .order('unlock_date', { ascending: true }),
    adminClient
      .from('clubs')
      .select('max_members, member_approval, creator_id')
      .eq('id', club.id)
      .maybeSingle(),
    userId
      ? adminClient
          .from('club_waitlist')
          .select('user_id')
          .eq('club_id', club.id)
          .eq('user_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    canModerate
      ? adminClient
          .from('club_waitlist')
          .select('user_id', { count: 'exact', head: true })
          .eq('club_id', club.id)
      : Promise.resolve({ count: 0 }),
    adminClient
      .from('club_books')
      .select('book_id', { count: 'exact', head: true })
      .eq('club_id', club.id),
  ])
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

  const scheduleEntries =
    (scheduleRows as
      | Array<{ id: string; chapter_name: string; unlock_date: string }>
      | null) ?? []
  // Chapters still locked (unlock_date in the future), keyed by normalized name,
  // for spoiler-gating Discussions threads.
  const nowMs = Date.now()
  const lockedChapterDates: Record<string, string> = {}
  for (const e of scheduleEntries) {
    if (new Date(e.unlock_date).getTime() > nowMs) {
      lockedChapterDates[e.chapter_name.trim().toLowerCase()] = e.unlock_date
    }
  }

  const capacity = capacityRow as
    | {
        max_members: number | null
        member_approval: boolean | null
        creator_id: string | null
      }
    | null
  const creatorId = capacity?.creator_id ?? null
  const maxMembers = capacity?.max_members ?? null
  const clubMemberApproval = Boolean(capacity?.member_approval)
  const isFull =
    maxMembers !== null && (club.member_count ?? 0) >= maxMembers
  const isOnWaitlist = Boolean(ownWaitlistRow)
  const requiresApproval = !isMember && clubMemberApproval
  const membershipStatus =
    requiresApproval && userId
      ? await getClubMembershipStatus(club.id, userId)
      : null
  const bookPath = club.current_book?.slug ?? club.current_book?.id

  const roster = members
    .filter((m) => m.status === 'active' || m.status === null)
    .map((m) => ({
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      username: m.profile?.username ?? '',
      display_name: m.profile?.display_name ?? '',
      avatar_url: m.profile?.avatar_url ?? null,
    }))
    .filter((m) => m.username)

  const overviewNode = (
    <div className="flex flex-col gap-6">
      <AnnouncementsSection
        clubId={club.id}
        announcements={announcements}
        canModerate={canModerate}
      />
      {canModerate && (
        <PostAnnouncementForm
          clubId={club.id}
          defaultCity={club.bookstore_city}
          defaultState={club.bookstore_state}
          canPin
        />
      )}
      {club.current_book && bookPath && (
        <section className="flex flex-col gap-5 rounded-lg border border-border-subtle bg-bg-surface p-5">
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
              <p className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
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
    </div>
  )

  const discussionsNode = (
    <div className="flex flex-col gap-6">
      <DiscussionsSection
        clubId={club.id}
        clubSlug={club.slug ?? club.id}
        threads={threads}
        isMember={isMember}
        viewerId={userId}
        canModerate={canModerate}
        lockedChapterDates={lockedChapterDates}
      />
      {club.current_book && club.current_book_id && (
        <ThreadDiscussionPanel
          bookId={club.current_book_id}
          bookSlug={club.current_book.slug}
          bookTitle={club.current_book.title}
          initialQuestions={discussionGuide?.questions ?? null}
          canGenerate={canModerate}
        />
      )}
    </div>
  )

  const sections: Partial<Record<ClubTabKey, ReactNode>> = {
    overview: overviewNode,
    discussions: discussionsNode,
    meetings: (
      <MeetingsSection
        clubId={club.id}
        clubSlug={club.slug ?? club.id}
        upcoming={meetingData.upcoming}
        past={meetingData.past}
        canModerate={canModerate}
        isMember={isMember}
        defaultCity={club.bookstore_city}
        defaultState={club.bookstore_state}
      />
    ),
    polls: (
      <PollsSection
        clubId={club.id}
        polls={polls}
        canModerate={canModerate}
        isMember={isMember}
      />
    ),
    members: (
      <MembersSection
        members={roster}
        clubId={club.id}
        clubSlug={club.slug ?? club.id}
        viewerId={userId}
        viewerRole={role}
        creatorId={creatorId}
      />
    ),
  }
  const available: ClubTabKey[] = [
    'overview',
    'discussions',
    'meetings',
    'polls',
    'members',
  ]
  if (isMember) {
    sections.schedule = (
      <ScheduleSection
        clubId={club.id}
        entries={scheduleEntries}
        canManage={canModerate}
      />
    )
    available.push('schedule')
  }
  if (canModerate) {
    sections.moderation = (
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
    )
    available.push('moderation')
  }
  if (role === 'admin') {
    sections.settings = (
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
          current_book: club.current_book
            ? {
                id: club.current_book.id,
                slug: club.current_book.slug,
                title: club.current_book.title,
                author: club.current_book.author,
                cover_url: club.current_book.cover_url,
              }
            : null,
          discord_webhook_url: adminClubFields?.discord_webhook_url ?? null,
        }}
      />
    )
    available.push('settings')
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-fraunces text-[2rem] text-text-primary">
                {club.name}
              </h1>
              {memberSeesDiscordBadge && (
                <span className="rounded-full bg-brand-subtle px-2.5 py-1 font-dm-mono text-[0.625rem] uppercase tracking-wider text-brand-subtle-text">
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
            {(clubBookCount ?? 0) > 0 && (
              <Link
                href={`/clubs/${club.slug ?? club.id}/library`}
                className="font-dm-sans text-sm text-brand-text hover:underline"
              >
                View club library ({clubBookCount} books)
              </Link>
            )}
          </header>

          <VerifiedBookstoreHeader club={club} />

          {!isMember && (
            <section className="mt-6 flex flex-wrap items-center gap-3">
              {isFull ? (
                userId ? (
                  <WaitlistButton clubId={club.id} onWaitlist={isOnWaitlist} />
                ) : (
                  <Link href="/sign-in">
                    <Button variant="primary" size="md">
                      Sign in to join waitlist
                    </Button>
                  </Link>
                )
              ) : requiresApproval ? (
                userId ? (
                  <RequestJoinButton
                    clubId={club.id}
                    alreadyPending={membershipStatus === 'pending'}
                  />
                ) : (
                  <Link href={`/sign-in?next=/clubs/${params.slug}`}>
                    <Button variant="primary" size="md">
                      Sign in to request to join
                    </Button>
                  </Link>
                )
              ) : userId ? (
                <JoinClubButton clubId={club.id} />
              ) : (
                <Link href={`/sign-in?next=/clubs/${params.slug}`}>
                  <Button variant="primary" size="md">
                    Sign in to join
                  </Button>
                </Link>
              )}
              {isFull && (
                <p className="font-dm-mono text-xs text-text-tertiary">
                  Club is full ({club.member_count} of {maxMembers}).
                </p>
              )}
            </section>
          )}

          <ClubWorkspace
            defaultTab="discussions"
            available={available}
            sections={sections}
          />
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
