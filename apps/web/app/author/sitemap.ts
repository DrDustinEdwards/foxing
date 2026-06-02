import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 604800
export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('books')
      .select('author_slug')
      .not('author_slug', 'is', null)
    const slugs = [...new Set((data ?? []).map((r) => r.author_slug as string))]
    return slugs.map((slug) => ({
      url: `${FOXING_BASE_URL}/author/${slug}`,
      changeFrequency: 'monthly',
      priority: 0.7,
    }))
  } catch {
    return []
  }
}
