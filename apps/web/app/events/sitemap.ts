import type { MetadataRoute } from 'next'
import { fetchEventStates } from '@/lib/events'
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
    const states = await fetchEventStates()
    const now = new Date()
    return states.map((s) => ({
      url: `${FOXING_BASE_URL}/events/${s.toLowerCase()}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    }))
  } catch {
    return []
  }
}
