import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface Bookmark {
  id: string
  cfi: string | null
  name: string | null
  created_at: string
}

export async function fetchUserBookmarks(
  userId: string,
  bookId: string,
): Promise<Bookmark[]> {
  const sb = await createClient()
  const { data } = await sb
    .from('bookmarks')
    .select('id, cfi, name, created_at')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  return (data as Bookmark[] | null) ?? []
}

export async function userHasBookInLibrary(
  userId: string,
  bookId: string,
): Promise<boolean> {
  const sb = await createClient()
  const { data } = await sb
    .from('user_books')
    .select('status')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle()
  const row = data as { status: string | null } | null
  return Boolean(
    row && ['reading', 'finished', 'paused'].includes(row.status ?? ''),
  )
}

export interface UserBookStatus {
  status: string | null
  progress_percentage: number | null
}

export async function fetchUserBookStatus(
  userId: string,
  bookId: string,
): Promise<UserBookStatus | null> {
  const sb = await createClient()
  const { data } = await sb
    .from('user_books')
    .select('status, progress_percentage')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle()
  return (data as UserBookStatus | null) ?? null
}

export async function fetchUserBookTags(
  userId: string,
  bookId: string,
): Promise<string[]> {
  const sb = await createClient()
  const { data } = await sb
    .from('user_book_tags')
    .select('tag')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .order('tag', { ascending: true })
  return ((data as { tag: string }[] | null) ?? []).map((r) => r.tag)
}
