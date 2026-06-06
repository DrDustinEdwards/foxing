import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'
import { slugifySeriesName } from '@/lib/slug'

export const revalidate = 604800
export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('books')
      .select('series_name')
      .not('series_name', 'is', null)
      .neq('series_name', '')
    const names = [...new Set((data ?? []).map((r) => r.series_name as string))]
    const now = new Date()
    return names.map((name) => ({
      url: `${FOXING_BASE_URL}/series/${slugifySeriesName(name)}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    }))
  } catch {
    return []
  }
}
