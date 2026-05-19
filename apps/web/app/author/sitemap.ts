import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

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
      .select('author_slug')
      .not('author_slug', 'is', null)
    const rows =
      (data as Array<{ author_slug: string | null }> | null) ?? []
    const slugs = new Set<string>()
    for (const r of rows) {
      if (r.author_slug) slugs.add(r.author_slug)
    }
    const now = new Date()
    return [...slugs].map((slug) => ({
      url: `${FOXING_BASE_URL}/author/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    }))
  } catch {
    return []
  }
}
