import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 600
export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('clubs')
      .select('slug, updated_at, created_at')
      .eq('visibility', 'public')
      .not('slug', 'is', null)
    return (data ?? []).map((c) => ({
      url: `${FOXING_BASE_URL}/clubs/${c.slug}`,
      lastModified: c.updated_at ?? c.created_at,
      changeFrequency: 'weekly',
      priority: 0.6,
    }))
  } catch {
    return []
  }
}
