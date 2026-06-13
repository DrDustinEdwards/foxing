import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'
import { JOURNAL_TAGS } from '@/lib/journal'

export const revalidate = 3_600
export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const tagEntries: MetadataRoute.Sitemap = JOURNAL_TAGS.map((t) => ({
    url: `${FOXING_BASE_URL}/journal/tag/${t.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return tagEntries
  }
  try {
    const supabase = createAdminClient()
    // Page in chunks of 1000 to defeat the PostgREST max-rows cap; the unbounded
    // read silently returned only the first 1000 published posts.
    const rows: Array<{
      slug: string
      updated_at: string | null
      published_at: string | null
    }> = []
    const chunk = 1000
    const max = 50000
    for (let from = 0; from < max; from += chunk) {
      const { data } = await supabase
        .from('journal_posts')
        .select('slug, updated_at, published_at')
        .eq('is_published', true)
        .order('id')
        .range(from, from + chunk - 1)
      const page =
        (data as Array<{
          slug: string
          updated_at: string | null
          published_at: string | null
        }> | null) ?? []
      rows.push(...page)
      if (page.length < chunk) break
    }
    const postEntries: MetadataRoute.Sitemap = rows.map((p) => ({
      url: `${FOXING_BASE_URL}/journal/${p.slug}`,
      lastModified: p.updated_at
        ? new Date(p.updated_at)
        : p.published_at
          ? new Date(p.published_at)
          : now,
      changeFrequency: 'monthly',
      priority: 0.7,
    }))
    return [...postEntries, ...tagEntries]
  } catch {
    return tagEntries
  }
}
