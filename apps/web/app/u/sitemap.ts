import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 600
export const dynamic = 'force-static'

const PAGE_SIZE = 50_000

export async function generateSitemaps() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return [{ id: 0 }]
  }
  try {
    const supabase = createAdminClient()
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true)
      .not('username', 'is', null)
    const total = count ?? 0
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    return Array.from({ length: pages }, (_, i) => ({ id: i }))
  } catch {
    return [{ id: 0 }]
  }
}

export default async function sitemap({
  id,
}: {
  id: number
}): Promise<MetadataRoute.Sitemap> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return []
  }
  try {
    const supabase = createAdminClient()
    const from = id * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data } = await supabase
      .from('profiles')
      .select('username, updated_at, created_at')
      .eq('is_public', true)
      .not('username', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, to)
    const rows =
      (data as Array<{
        username: string | null
        updated_at: string | null
        created_at: string
      }> | null) ?? []
    return rows
      .filter((p) => Boolean(p.username))
      .map((p) => ({
        url: `${FOXING_BASE_URL}/u/${encodeURIComponent(p.username!)}`,
        lastModified: p.updated_at
          ? new Date(p.updated_at)
          : new Date(p.created_at),
        changeFrequency: 'weekly',
        priority: 0.5,
      }))
  } catch {
    return []
  }
}
