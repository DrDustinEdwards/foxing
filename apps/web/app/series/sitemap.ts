import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL, slugifySeriesName } from '@/lib/metadata'

export const revalidate = 604_800
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
      .from('books')
      .select('series_name')
      .not('series_name', 'is', null)
    const rows =
      (data as Array<{ series_name: string | null }> | null) ?? []
    const slugs = new Set<string>()
    for (const r of rows) {
      if (!r.series_name) continue
      const slug = slugifySeriesName(r.series_name)
      if (slug) slugs.add(slug)
    }
    const now = new Date()
    return [...slugs].map((slug) => ({
      url: `${FOXING_BASE_URL}/series/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    }))
  } catch {
    return []
  }
}
