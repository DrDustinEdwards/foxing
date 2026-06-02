import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 600
export const dynamic = 'force-static'

export async function generateSitemaps() {
  try {
    const supabase = createAdminClient()
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true)
      .not('username', 'is', null)
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
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('profiles')
      .select('username, updated_at, created_at')
      .eq('is_public', true)
      .not('username', 'is', null)
      .order('id')
      .range(id * 50000, id * 50000 + 49999)
    return (data ?? []).map((p) => ({
      url: `${FOXING_BASE_URL}/u/${p.username}`,
      lastModified: p.updated_at ?? p.created_at,
      changeFrequency: 'weekly',
      priority: 0.5,
    }))
  } catch {
    return []
  }
}
