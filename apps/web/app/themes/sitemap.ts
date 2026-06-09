import type { MetadataRoute } from 'next'
import { THEME_DEFINITIONS, FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 86400
export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return Object.keys(THEME_DEFINITIONS).map((key) => ({
    url: `${FOXING_BASE_URL}/themes/${key}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))
}
