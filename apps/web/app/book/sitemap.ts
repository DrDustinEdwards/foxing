import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 604_800
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
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('slug', 'is', null)
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
      .from('books')
      .select('slug, updated_at, created_at')
      .not('slug', 'is', null)
      .order('id')
      .range(from, to)
    const rows =
      (data as Array<{
        slug: string | null
        updated_at: string | null
        created_at: string | null
      }> | null) ?? []
    return rows
      .filter((b) => Boolean(b.slug))
      .map((b) => ({
        url: `${FOXING_BASE_URL}/book/${b.slug}`,
        lastModified: b.updated_at
          ? new Date(b.updated_at)
          : b.created_at
            ? new Date(b.created_at)
            : new Date(),
        changeFrequency: 'monthly',
        priority: 0.8,
      }))
  } catch {
    return []
  }
}
