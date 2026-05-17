// Named bookmarks, per-user, per-book, anchored to a CFI.
//
// SQL SCHEMA (applied externally):
//
//   create table bookmarks (
//     id uuid primary key default gen_random_uuid(),
//     user_id uuid not null references auth.users(id) on delete cascade,
//     book_id uuid not null references books(id) on delete cascade,
//     cfi text not null,
//     name text,
//     created_at timestamptz not null default now()
//   );

import { supabase } from './supabase'

export interface BookmarkRow {
  id: string
  user_id: string
  book_id: string
  cfi: string
  name: string | null
  created_at: string
}

export async function listBookmarks(bookId: string): Promise<BookmarkRow[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('bookmarks')
    .select('id, user_id, book_id, cfi, name, created_at')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[bookmarks] list failed:', error.message)
    return []
  }
  return ((data ?? []) as BookmarkRow[])
}

export async function createBookmark(input: {
  bookId: string
  cfi: string
  name?: string | null
}): Promise<BookmarkRow | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('bookmarks')
    .insert({
      user_id: user.id,
      book_id: input.bookId,
      cfi: input.cfi,
      name: input.name ?? null,
    })
    .select('id, user_id, book_id, cfi, name, created_at')
    .single()
  if (error) {
    console.warn('[bookmarks] create failed:', error.message)
    return null
  }
  return (data as BookmarkRow) ?? null
}

export async function deleteBookmark(id: string): Promise<boolean> {
  const { error } = await supabase.from('bookmarks').delete().eq('id', id)
  if (error) console.warn('[bookmarks] delete failed:', error.message)
  return !error
}

export async function findBookmarkAtCfi(
  bookId: string,
  cfi: string,
): Promise<BookmarkRow | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('bookmarks')
    .select('id, user_id, book_id, cfi, name, created_at')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .eq('cfi', cfi)
    .maybeSingle()
  return (data as BookmarkRow | null) ?? null
}
