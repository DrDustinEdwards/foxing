import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 86400
export const dynamic = 'force-static'

// /quotes/{id} pages are public highlights.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return []
  }
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('highlights')
      .select('id, updated_at')
      .eq('is_public', true)
      .limit(50000)
    return (data ?? []).map((h) => ({
      url: `${FOXING_BASE_URL}/quotes/${h.id}`,
      lastModified: h.updated_at ?? undefined,
      changeFrequency: 'monthly',
      priority: 0.4,
    }))
  } catch {
    return []
  }
}
