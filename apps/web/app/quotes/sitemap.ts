import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 86400
export const dynamic = 'force-static'

// /quotes/{id} pages are public highlights. highlights grows with users, so
// page in chunks of 1000 to defeat the PostgREST max-rows cap (a bare
// .limit(50000) silently returns only the first 1000 rows).
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
        .from('highlights')
        .select('id, updated_at')
        .eq('is_public', true)
        .order('id')
        .range(from, from + chunk - 1)
      const rows = (data as { id: string; updated_at: string | null }[] | null) ?? []
      for (const h of rows) {
        out.push({
          url: `${FOXING_BASE_URL}/quotes/${h.id}`,
          lastModified: h.updated_at ?? undefined,
          changeFrequency: 'monthly',
          priority: 0.4,
        })
      }
      if (rows.length < chunk) break
    }
    return out
  } catch {
    return []
  }
}
