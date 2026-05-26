import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface CommonplaceEntry {
  id: string
  user_id: string
  passage_text: string
  book_id: string | null
  book_title: string | null
  cfi: string | null
  note: string | null
  is_public: boolean
  created_at: string
  book: {
    id: string
    slug: string | null
    title: string
    author: string
  } | null
}

const COLS =
  'id, user_id, passage_text, book_id, book_title, cfi, note, is_public, created_at, book:book_id(id, slug, title, author)' as const

export async function fetchUserCommonplace(
  userId: string,
): Promise<CommonplaceEntry[]> {
  const sb = await createClient()
  const { data } = await sb
    .from('commonplace_book')
    .select(COLS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data as unknown as CommonplaceEntry[] | null) ?? []
}

export async function fetchPublicCommonplace(
  userId: string,
  limit = 5,
): Promise<CommonplaceEntry[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('commonplace_book')
    .select(COLS)
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as unknown as CommonplaceEntry[] | null) ?? []
}
