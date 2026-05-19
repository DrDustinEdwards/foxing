import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 3_600
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
      .from('reading_lists')
      .select('slug, updated_at, created_at, profiles:user_id(username)')
      .eq('is_public', true)
    const rows =
      (data as unknown as Array<{
        slug: string | null
        updated_at: string | null
        created_at: string
        profiles: { username: string | null } | null
      }> | null) ?? []
    return rows
      .filter((l) => Boolean(l.slug) && Boolean(l.profiles?.username))
      .map((l) => ({
        url: `${FOXING_BASE_URL}/u/${l.profiles!.username}/lists/${l.slug}`,
        lastModified: l.updated_at
          ? new Date(l.updated_at)
          : new Date(l.created_at),
        changeFrequency: 'monthly',
        priority: 0.5,
      }))
  } catch {
    return []
  }
}
