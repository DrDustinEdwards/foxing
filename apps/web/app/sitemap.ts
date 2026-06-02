import type { MetadataRoute } from 'next'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 86400
export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    { url: FOXING_BASE_URL, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${FOXING_BASE_URL}/books`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${FOXING_BASE_URL}/book-clubs`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${FOXING_BASE_URL}/journal`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${FOXING_BASE_URL}/book-of-the-month`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${FOXING_BASE_URL}/features`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${FOXING_BASE_URL}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${FOXING_BASE_URL}/events`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${FOXING_BASE_URL}/giveaways`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${FOXING_BASE_URL}/awards`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${FOXING_BASE_URL}/guide`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${FOXING_BASE_URL}/app-guide`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${FOXING_BASE_URL}/people`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${FOXING_BASE_URL}/clubs`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${FOXING_BASE_URL}/challenges`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${FOXING_BASE_URL}/quotes`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${FOXING_BASE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${FOXING_BASE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${FOXING_BASE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
