import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 3_600
export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return []
  }
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('journal_posts')
      .select('slug, updated_at, published_at')
      .eq('is_published', true)
    const rows =
      (data as Array<{
        slug: string
        updated_at: string | null
        published_at: string | null
      }> | null) ?? []
    const now = new Date()
    return rows.map((p) => ({
      url: `${FOXING_BASE_URL}/journal/${p.slug}`,
      lastModified: p.updated_at
        ? new Date(p.updated_at)
        : p.published_at
          ? new Date(p.published_at)
          : now,
      changeFrequency: 'monthly',
      priority: 0.7,
    }))
  } catch {
    return []
  }
}
