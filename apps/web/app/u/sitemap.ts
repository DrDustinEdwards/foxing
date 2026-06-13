import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 600
export const dynamic = 'force-static'

const SUBPAGES = ['library', 'diary', 'lists', 'highlights', 'reviews'] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return []
  }
  const supabase = createAdminClient()
  const entries: MetadataRoute.Sitemap = []
  const CHUNK = 1000
  const MAX = 50000

  // Public profiles + their indexable sub-pages. Page in chunks of 1000 to
  // defeat the PostgREST max-rows cap (a bare .limit(50000) silently returns
  // only the first 1000 rows once profiles grows past that).
  try {
    for (let from = 0; from < MAX; from += CHUNK) {
      const { data } = await supabase
        .from('profiles')
        .select('username, updated_at, created_at')
        .eq('is_public', true)
        .not('username', 'is', null)
        .order('id')
        .range(from, from + CHUNK - 1)
      const rows = (data as { username: string; updated_at: string | null; created_at: string }[] | null) ?? []
      for (const p of rows) {
        const u = encodeURIComponent(p.username)
        const lm = p.updated_at ?? p.created_at
        entries.push({ url: `${FOXING_BASE_URL}/u/${u}`, lastModified: lm, changeFrequency: 'weekly', priority: 0.5 })
        for (const sub of SUBPAGES) {
          entries.push({ url: `${FOXING_BASE_URL}/u/${u}/${sub}`, lastModified: lm, changeFrequency: 'weekly', priority: 0.4 })
        }
      }
      if (rows.length < CHUNK) break
    }
  } catch {
    // partial sitemap beats a 500
  }

  // Public diary entries -> /u/{username}/diary/{slug}. Both the diary read and
  // the username lookup are chunked past the 1000-row cap.
  try {
    const diary: { slug: string; updated_at: string | null; user_id: string }[] = []
    for (let from = 0; from < MAX; from += CHUNK) {
      const { data: diaryData } = await supabase
        .from('diary_entries')
        .select('slug, updated_at, user_id')
        .eq('privacy', 'public')
        .not('slug', 'is', null)
        .order('id')
        .range(from, from + CHUNK - 1)
      const rows = (diaryData as { slug: string; updated_at: string | null; user_id: string }[] | null) ?? []
      diary.push(...rows)
      if (rows.length < CHUNK) break
    }
    if (diary.length > 0) {
      const ids = [...new Set(diary.map((d) => d.user_id))]
      const usernameById = new Map<string, string>()
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', ids.slice(i, i + CHUNK))
        for (const r of (profData as { id: string; username: string | null }[] | null) ?? []) {
          if (r.username) usernameById.set(r.id, r.username)
        }
      }
      for (const d of diary) {
        const username = usernameById.get(d.user_id)
        if (!username) continue
        entries.push({
          url: `${FOXING_BASE_URL}/u/${encodeURIComponent(username)}/diary/${d.slug}`,
          lastModified: d.updated_at ?? undefined,
          changeFrequency: 'monthly',
          priority: 0.4,
        })
      }
    }
  } catch {
    // partial sitemap beats a 500
  }

  return entries
}
