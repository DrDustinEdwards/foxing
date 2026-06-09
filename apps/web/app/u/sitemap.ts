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

  // Public profiles + their indexable sub-pages.
  try {
    const { data } = await supabase
      .from('profiles')
      .select('username, updated_at, created_at')
      .eq('is_public', true)
      .not('username', 'is', null)
      .limit(50000)
    for (const p of (data as { username: string; updated_at: string | null; created_at: string }[] | null) ?? []) {
      const u = encodeURIComponent(p.username)
      const lm = p.updated_at ?? p.created_at
      entries.push({ url: `${FOXING_BASE_URL}/u/${u}`, lastModified: lm, changeFrequency: 'weekly', priority: 0.5 })
      for (const sub of SUBPAGES) {
        entries.push({ url: `${FOXING_BASE_URL}/u/${u}/${sub}`, lastModified: lm, changeFrequency: 'weekly', priority: 0.4 })
      }
    }
  } catch {
    // partial sitemap beats a 500
  }

  // Public diary entries -> /u/{username}/diary/{slug}
  try {
    const { data: diaryData } = await supabase
      .from('diary_entries')
      .select('slug, updated_at, user_id')
      .eq('privacy', 'public')
      .not('slug', 'is', null)
    const diary = (diaryData as { slug: string; updated_at: string | null; user_id: string }[] | null) ?? []
    if (diary.length > 0) {
      const ids = [...new Set(diary.map((d) => d.user_id))]
      const { data: profData } = await supabase.from('profiles').select('id, username').in('id', ids)
      const usernameById = new Map(
        ((profData as { id: string; username: string | null }[] | null) ?? [])
          .filter((r) => r.username)
          .map((r) => [r.id, r.username as string]),
      )
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
