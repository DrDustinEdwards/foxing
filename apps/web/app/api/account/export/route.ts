import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PAGE = 1000
const IN_CHUNK = 200

type Row = Record<string, unknown>
type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * One exported data family: rows from `table` where `column` = the calling
 * user's id, ordered by `order` so .range() pagination is stable.
 */
interface FamilySpec {
  key: string
  table: string
  column: string
  order: string
}

const FAMILIES: FamilySpec[] = [
  { key: 'library', table: 'user_books', column: 'user_id', order: 'created_at' },
  { key: 'custom_shelves', table: 'custom_shelves', column: 'user_id', order: 'created_at' },
  { key: 'book_tags', table: 'user_book_tags', column: 'user_id', order: 'book_id' },
  { key: 'favorites', table: 'user_favorites', column: 'user_id', order: 'position' },
  { key: 'diary', table: 'diary_entries', column: 'user_id', order: 'created_at' },
  { key: 'reading_sessions', table: 'reading_sessions', column: 'user_id', order: 'started_at' },
  { key: 'reading_streak', table: 'reading_streaks', column: 'user_id', order: 'user_id' },
  { key: 'reading_goals', table: 'reading_goals', column: 'user_id', order: 'created_at' },
  { key: 'highlights', table: 'highlights', column: 'user_id', order: 'created_at' },
  { key: 'bookmarks', table: 'bookmarks', column: 'user_id', order: 'created_at' },
  { key: 'vocabulary', table: 'vocabulary', column: 'user_id', order: 'created_at' },
  { key: 'commonplace_book', table: 'commonplace_book', column: 'user_id', order: 'created_at' },
  { key: 'commonplace_entries', table: 'commonplace_entries', column: 'user_id', order: 'created_at' },
  { key: 'quote_cards', table: 'quote_cards', column: 'user_id', order: 'created_at' },
  { key: 'chapter_reactions', table: 'chapter_reactions', column: 'user_id', order: 'created_at' },
  { key: 'reading_lists', table: 'reading_lists', column: 'user_id', order: 'created_at' },
  { key: 'list_likes_given', table: 'reading_list_likes', column: 'user_id', order: 'created_at' },
  { key: 'highlight_likes_given', table: 'highlight_likes', column: 'user_id', order: 'created_at' },
  { key: 'club_memberships', table: 'club_members', column: 'user_id', order: 'joined_at' },
  { key: 'club_waitlist', table: 'club_waitlist', column: 'user_id', order: 'joined_at' },
  { key: 'club_threads', table: 'club_threads', column: 'author_id', order: 'created_at' },
  { key: 'club_posts', table: 'club_posts', column: 'author_id', order: 'created_at' },
  { key: 'club_announcements', table: 'club_announcements', column: 'created_by', order: 'created_at' },
  { key: 'club_meetings_created', table: 'club_meetings', column: 'created_by', order: 'created_at' },
  { key: 'club_meeting_rsvps', table: 'club_meeting_rsvps', column: 'user_id', order: 'created_at' },
  { key: 'club_polls_created', table: 'club_polls', column: 'created_by', order: 'created_at' },
  { key: 'club_poll_votes', table: 'club_poll_votes', column: 'user_id', order: 'created_at' },
  { key: 'club_invites_received', table: 'club_invites', column: 'invited_user_id', order: 'created_at' },
  { key: 'club_invites_sent', table: 'club_invites', column: 'invited_by', order: 'created_at' },
  { key: 'discussions', table: 'discussions', column: 'author_id', order: 'created_at' },
  { key: 'discussion_posts', table: 'discussion_posts', column: 'author_id', order: 'created_at' },
  { key: 'passage_comments', table: 'passage_comments', column: 'author_id', order: 'created_at' },
  { key: 'passage_comment_replies', table: 'passage_comment_replies', column: 'author_id', order: 'created_at' },
  { key: 'buddy_read_posts', table: 'buddy_read_posts', column: 'author_id', order: 'created_at' },
  { key: 'post_reactions', table: 'post_reactions', column: 'user_id', order: 'created_at' },
  { key: 'club_post_reactions', table: 'club_post_reactions', column: 'user_id', order: 'created_at' },
  { key: 'passage_comment_reactions', table: 'passage_comment_reactions', column: 'user_id', order: 'created_at' },
  { key: 'passage_reactions', table: 'passage_reactions', column: 'user_id', order: 'created_at' },
  { key: 'saved_posts', table: 'saved_posts', column: 'user_id', order: 'saved_at' },
  { key: 'close_friends', table: 'close_friends', column: 'user_id', order: 'created_at' },
  { key: 'following', table: 'follows', column: 'follower_id', order: 'created_at' },
  { key: 'followers', table: 'follows', column: 'following_id', order: 'created_at' },
  { key: 'challenges_created', table: 'challenges', column: 'creator_id', order: 'created_at' },
  { key: 'challenge_progress', table: 'user_challenges', column: 'user_id', order: 'joined_at' },
  { key: 'badges_earned', table: 'user_badges', column: 'user_id', order: 'earned_at' },
  { key: 'giveaway_entries', table: 'giveaway_entries', column: 'user_id', order: 'entered_at' },
  { key: 'reports_filed', table: 'post_reports', column: 'reporter_id', order: 'created_at' },
  { key: 'author_claims', table: 'author_claims', column: 'user_id', order: 'submitted_at' },
  { key: 'author_questions_asked', table: 'author_questions', column: 'asker_id', order: 'asked_at' },
  { key: 'author_question_upvotes', table: 'author_question_upvotes', column: 'user_id', order: 'question_id' },
  { key: 'discord_sprint_logs', table: 'discord_sprint_participants', column: 'user_id', order: 'logged_at' },
  { key: 'notifications', table: 'notifications', column: 'user_id', order: 'created_at' },
  { key: 'ai_usage', table: 'ai_rate_limits', column: 'user_id', order: 'date' },
]

async function fetchAll(
  sb: Supabase,
  table: string,
  column: string,
  value: string,
  order: string,
): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .eq(column, value)
      .order(order, { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data as Row[] | null) ?? []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

async function fetchAllIn(
  sb: Supabase,
  table: string,
  column: string,
  values: string[],
  order: string,
): Promise<Row[]> {
  const rows: Row[] = []
  for (let i = 0; i < values.length; i += IN_CHUNK) {
    const chunk = values.slice(i, i + IN_CHUNK)
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from(table)
        .select('*')
        .in(column, chunk)
        .order(order, { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      rows.push(...((data as Row[] | null) ?? []))
      if (!data || data.length < PAGE) break
    }
  }
  return rows
}

function collectBookIds(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const row of value) {
      const id = (row as Row | null)?.book_id
      if (typeof id === 'string') into.add(id)
    }
  }
}

export async function GET(_request: NextRequest) {
  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    return new NextResponse('Unauthenticated', { status: 401 })
  }

  const data: Record<string, unknown> = {}
  const errors: Record<string, string> = {}

  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) errors.profile = profileError.message
  data.profile = profile ?? null
  data.account = { id: user.id, email: user.email, created_at: user.created_at }

  for (const family of FAMILIES) {
    try {
      data[family.key] = await fetchAll(
        sb,
        family.table,
        family.column,
        user.id,
        family.order,
      )
    } catch (err) {
      errors[family.key] = err instanceof Error ? err.message : 'query failed'
      data[family.key] = []
    }
  }

  // buddy_reads keys the user on either side
  try {
    const rows: Row[] = []
    for (let from = 0; ; from += PAGE) {
      const { data: page, error } = await sb
        .from('buddy_reads')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('started_at', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      rows.push(...((page as Row[] | null) ?? []))
      if (!page || page.length < PAGE) break
    }
    data.buddy_reads = rows
  } catch (err) {
    errors.buddy_reads = err instanceof Error ? err.message : 'query failed'
    data.buddy_reads = []
  }

  // children of exported parents
  try {
    const shelfIds = (data.custom_shelves as Row[]).map((s) => String(s.id))
    data.custom_shelf_books = shelfIds.length
      ? await fetchAllIn(sb, 'custom_shelf_books', 'shelf_id', shelfIds, 'added_at')
      : []
  } catch (err) {
    errors.custom_shelf_books = err instanceof Error ? err.message : 'query failed'
    data.custom_shelf_books = []
  }
  try {
    const listIds = (data.reading_lists as Row[]).map((l) => String(l.id))
    data.reading_list_books = listIds.length
      ? await fetchAllIn(sb, 'reading_list_books', 'list_id', listIds, 'position')
      : []
  } catch (err) {
    errors.reading_list_books = err instanceof Error ? err.message : 'query failed'
    data.reading_list_books = []
  }

  // book_id -> title/author lookup so the archive is readable on its own
  const bookIds = new Set<string>()
  for (const value of Object.values(data)) collectBookIds(value, bookIds)
  const books: Record<string, Row> = {}
  try {
    const ids = Array.from(bookIds)
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
      const { data: page, error } = await sb
        .from('books')
        .select('id, title, author, slug')
        .in('id', ids.slice(i, i + IN_CHUNK))
      if (error) throw new Error(error.message)
      for (const b of (page as Row[] | null) ?? []) {
        books[String(b.id)] = { title: b.title, author: b.author, slug: b.slug }
      }
    }
  } catch (err) {
    errors.books = err instanceof Error ? err.message : 'query failed'
  }

  const archive = {
    format: 'foxing-account-export/1',
    generated_at: new Date().toISOString(),
    user_id: user.id,
    data,
    books,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  }

  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(archive, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="foxing-export-${today}.json"`,
      'cache-control': 'private, no-store',
    },
  })
}
