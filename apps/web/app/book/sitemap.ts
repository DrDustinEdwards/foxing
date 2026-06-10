import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 604800
export const dynamic = 'force-static'

// Single sitemap. Books are well under the 50k URL limit; revisit pagination
// (generateSitemaps) only if the catalog approaches that. Internal paging in
// chunks of 1000 to defeat the PostgREST max-rows cap.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return []
  }
  try {
    const supabase = createAdminClient()
    const out: MetadataRoute.Sitemap = []
    const chunk = 1000
    const max = 50000
    for (let from = 0; from < max; from += chunk) {
      const { data } = await supabase
        .from('books')
        .select('slug, updated_at, created_at')
        .not('slug', 'is', null)
        .order('id')
        .range(from, from + chunk - 1)
      const rows = data ?? []
      for (const b of rows) {
        out.push({
          url: `${FOXING_BASE_URL}/book/${b.slug}`,
          lastModified: b.updated_at ?? b.created_at,
          changeFrequency: 'monthly',
          priority: 0.8,
        })
      }
      if (rows.length < chunk) break
    }
    return out
  } catch {
    return []
  }
}
