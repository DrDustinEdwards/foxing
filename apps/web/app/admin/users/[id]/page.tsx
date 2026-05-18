import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatRelativeDate } from '@foxing/utils'
import {
  AdminToggle,
  DeleteUserButton,
  SendNotificationForm,
  SuspendedToggle,
  TierSelector,
} from './user-controls'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin user, Foxing',
}

interface ProfileRow {
  id: string
  display_name: string
  username: string
  avatar_url: string | null
  bio: string | null
  reading_personality: string | null
  created_at: string
  updated_at: string | null
  subscription_tier: string | null
  is_admin: boolean
  is_public: boolean
  is_suspended: boolean | null
}

interface FinishedBookRow {
  id: string
  rating: number | null
  finished_at: string | null
  books: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  } | null
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select(
      'id, display_name, username, avatar_url, bio, reading_personality, created_at, updated_at, subscription_tier, is_admin, is_public, is_suspended',
    )
    .eq('id', params.id)
    .maybeSingle()
  const user = profile as ProfileRow | null
  if (!user) notFound()

  const [
    authRes,
    bookCountRes,
    highlightCountRes,
    clubCountRes,
    diaryCountRes,
    lastUserBookRes,
    recentRes,
  ] = await Promise.all([
    admin.auth.admin.getUserById(user.id),
    admin
      .from('user_books')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'finished'),
    admin
      .from('highlights')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    admin
      .from('club_members')
      .select('club_id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    admin
      .from('diary_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    admin
      .from('user_books')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('user_books')
      .select(
        'id, rating, finished_at, books:book_id(id, slug, title, author, cover_url)',
      )
      .eq('user_id', user.id)
      .eq('status', 'finished')
      .order('finished_at', { ascending: false })
      .limit(5),
  ])
  const email = authRes.data.user?.email ?? null
  const lastSignIn = authRes.data.user?.last_sign_in_at ?? null
  const lastUserBookAt =
    (lastUserBookRes.data as { created_at: string } | null)?.created_at ?? null
  const lastActive = [user.updated_at, lastSignIn, lastUserBookAt]
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop() ?? null
  const booksCount = bookCountRes.count ?? 0
  const highlightCount = highlightCountRes.count ?? 0
  const clubCount = clubCountRes.count ?? 0
  const diaryCount = diaryCountRes.count ?? 0
  const recent = (recentRes.data as unknown as FinishedBookRow[] | null) ?? []

  return (
    <div className="p-6 md:p-10">
      <p className="mb-4 font-dm-sans text-sm">
        <Link href="/admin/users" className="text-brand-text hover:underline">
          ← All users
        </Link>
      </p>

      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar src={user.avatar_url} name={user.display_name} size="lg" />
          <div>
            <h1 className="font-fraunces text-[1.75rem] text-text-primary">
              {user.display_name}
            </h1>
            <p className="font-dm-mono text-sm text-text-tertiary">
              @{user.username}
            </p>
            <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
              {email ?? 'email hidden'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">
            Joined {formatRelativeDate(user.created_at)}
          </Badge>
          {lastActive && (
            <Badge variant="info">
              Last active {formatRelativeDate(lastActive)}
            </Badge>
          )}
          {user.is_admin && <Badge variant="warning">Admin</Badge>}
          {user.is_suspended && <Badge variant="warning">Suspended</Badge>}
          {!user.is_public && <Badge variant="neutral">Private profile</Badge>}
        </div>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <StatBlock label="Books finished" value={booksCount.toString()} />
        <StatBlock label="Highlights" value={highlightCount.toString()} />
        <StatBlock label="Clubs joined" value={clubCount.toString()} />
        <StatBlock label="Diary entries" value={diaryCount.toString()} />
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <Panel heading="Plan, role, and access">
          <div className="flex flex-col gap-4">
            <TierSelector userId={user.id} tier={user.subscription_tier ?? 'free'} />
            <AdminToggle userId={user.id} isAdmin={user.is_admin} />
            <SuspendedToggle
              userId={user.id}
              isSuspended={Boolean(user.is_suspended)}
            />
          </div>
        </Panel>

        <Panel heading="Send a notification">
          <SendNotificationForm userId={user.id} />
        </Panel>
      </section>

      <section className="mt-10">
        <Panel heading="Recently finished">
          {recent.length === 0 ? (
            <p className="font-source-serif-4 text-sm text-text-tertiary">
              No finished books yet.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {recent.map((row) =>
                row.books ? (
                  <li
                    key={row.id}
                    className="flex flex-col gap-2 rounded-md border border-border-subtle p-3"
                  >
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded bg-bg-sunken">
                      {row.books.cover_url && (
                        <Image
                          src={row.books.cover_url}
                          alt={row.books.title}
                          fill
                          sizes="120px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <Link
                      href={`/book/${row.books.slug ?? row.books.id}`}
                      className="line-clamp-2 font-fraunces text-sm text-text-primary hover:text-brand-text"
                    >
                      {row.books.title}
                    </Link>
                    <span className="font-dm-mono text-xs text-text-tertiary">
                      {row.rating !== null ? `${row.rating}★` : 'no rating'}
                    </span>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </Panel>
      </section>

      <section className="mt-10 rounded-lg border border-[var(--error-border-interactive)] bg-error-bg p-5">
        <h2 className="font-fraunces text-lg text-error">Delete account</h2>
        <p className="mt-1 font-source-serif-4 text-sm text-text-secondary">
          Removes the auth user and all RLS-cascaded rows. There is no undo.
        </p>
        <div className="mt-3">
          <DeleteUserButton userId={user.id} username={user.username} />
        </div>
      </section>

      <p className="mt-6 font-dm-mono text-xs text-text-tertiary">
        User id: {user.id}
      </p>
    </div>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-4">
      <p className="font-fraunces text-2xl text-text-primary">{value}</p>
      <p className="mt-1 font-dm-sans text-xs uppercase tracking-wide text-text-tertiary">
        {label}
      </p>
    </div>
  )
}

function Panel({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-surface p-5">
      <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        {heading}
      </h2>
      {children}
    </section>
  )
}
