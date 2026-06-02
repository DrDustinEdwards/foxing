import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 604800
export const dynamic = 'force-static'

export async function generateSitemaps() {
  try {
    const supabase = createAdminClient()
    const { count } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('slug', 'is', null)
    const pages = Math.ceil((count ?? 0) / 50000)
    return Array.from({ length: Math.max(1, pages) }, (_, i) => ({ id: i }))
  } catch {
    return [{ id: 0 }]
  }
}

export default async function sitemap(
  props: { id: Promise<string> },
): Promise<MetadataRoute.Sitemap> {
  try {
    const id = Number(await props.id)
    const from = id * 50000
    const to = from + 49999
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('books')
      .select('slug, updated_at, created_at')
      .not('slug', 'is', null)
      .order('id')
      .range(from, to)
    return (data ?? []).map((b) => ({
      url: `${FOXING_BASE_URL}/book/${b.slug}`,
      lastModified: b.updated_at ?? b.created_at,
      changeFrequency: 'monthly',
      priority: 0.8,
    }))
  } catch {
    return []
  }
}
