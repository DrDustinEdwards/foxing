import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface ActiveBOTM {
  title: string
  author: string
  slug: string | null
  curator_note: string | null
}

export async function fetchActiveBOTM(): Promise<ActiveBOTM | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null
  }
  const sb = await createClient()
  const { data } = await sb
    .from('book_of_the_month')
    .select(
      'curator_note, year, month, book:book_id(title, author, slug)',
    )
    .eq('is_published', true)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const row = data as unknown as {
    curator_note: string | null
    book: { title: string; author: string; slug: string | null } | null
  }
  if (!row.book) return null
  return {
    title: row.book.title,
    author: row.book.author,
    slug: row.book.slug,
    curator_note: row.curator_note,
  }
}
