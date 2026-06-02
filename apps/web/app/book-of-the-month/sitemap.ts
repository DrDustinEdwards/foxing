import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 86400
export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('book_of_the_month')
      .select('year, month, updated_at, created_at')
      .eq('is_published', true)
    return (data ?? []).map((p) => ({
      url: `${FOXING_BASE_URL}/book-of-the-month/${p.year}/${p.month}`,
      lastModified: p.updated_at ?? p.created_at,
      changeFrequency: 'monthly',
      priority: 0.8,
    }))
  } catch {
    return []
  }
}
