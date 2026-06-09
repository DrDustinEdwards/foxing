import type { MetadataRoute } from 'next'
import { fetchPassageOfDay } from '@/lib/missing-pages-queries'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 86400
export const dynamic = 'force-static'

const MAX_DAYS = 400

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Passage of the day is derived per date from public highlights and is
// noindex when none exists. Enumerate from the earliest public highlight to
// today, bounded, including only dates that resolve to a passage.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return []
  }
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('highlights')
      .select('created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: true })
      .limit(1)
    const rows = (data as { created_at: string }[] | null) ?? []
    if (rows.length === 0) return []

    const start = new Date(rows[0].created_at)
    start.setUTCHours(0, 0, 0, 0)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const out: MetadataRoute.Sitemap = []
    const cursor = new Date(start)
    for (let i = 0; i < MAX_DAYS && cursor <= today; i++) {
      const date = isoDate(cursor)
      const passage = await fetchPassageOfDay(date)
      if (passage) {
        out.push({
          url: `${FOXING_BASE_URL}/passage/${date}`,
          lastModified: date,
          changeFrequency: 'yearly',
          priority: 0.4,
        })
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return out
  } catch {
    return []
  }
}
