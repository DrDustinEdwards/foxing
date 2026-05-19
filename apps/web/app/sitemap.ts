import type { MetadataRoute } from 'next'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 86_400
export const dynamic = 'force-static'

const THEME_SLUGS = [
  'dark',
  'lighthearted',
  'emotional',
  'tense',
  'hopeful',
  'funny',
  'mysterious',
  'adventurous',
  'reflective',
  'romantic',
] as const

/**
 * Static-only sitemap. Pure hardcoded pages with no DB queries.
 * Dynamic content lives in per-route sub-sitemaps (book, author, u,
 * clubs, book-clubs, journal, events, series), each with its own
 * revalidate interval tuned to how fast that content changes.
 *
 * Next.js exposes /sitemap.xml as a sitemap index that aggregates
 * this file plus every sub-sitemap automatically.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    {
      url: FOXING_BASE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${FOXING_BASE_URL}/discover`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${FOXING_BASE_URL}/books`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${FOXING_BASE_URL}/clubs`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${FOXING_BASE_URL}/quotes`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${FOXING_BASE_URL}/search`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${FOXING_BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${FOXING_BASE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${FOXING_BASE_URL}/features`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${FOXING_BASE_URL}/guide`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${FOXING_BASE_URL}/app-guide`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${FOXING_BASE_URL}/awards`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${FOXING_BASE_URL}/challenges`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${FOXING_BASE_URL}/people`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${FOXING_BASE_URL}/book-clubs`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${FOXING_BASE_URL}/book-of-the-month`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${FOXING_BASE_URL}/journal`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${FOXING_BASE_URL}/events`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${FOXING_BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${FOXING_BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    ...THEME_SLUGS.map((slug) => ({
      url: `${FOXING_BASE_URL}/themes/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
