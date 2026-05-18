import type { MetadataRoute } from 'next'
import { FOXING_BASE_URL } from '@/lib/metadata'

/**
 * robots.txt. Block the admin dashboard, API routes, and every
 * authenticated surface from being crawled. Explicitly welcome major
 * AI crawlers and search engines on every public page. The sitemap
 * array advertises both the structured sitemap and the LLM-friendly
 * llms.txt summary.
 */
export default function robots(): MetadataRoute.Robots {
  const blockedPaths = [
    '/admin/',
    '/api/',
    '/sign-in',
    '/sign-up',
    '/sign-out',
    '/forgot-password',
    '/callback',
    '/home',
    '/library',
    '/diary',
    '/stats',
    '/highlights',
    '/goals',
    '/my-lists',
    '/find-next-book',
    '/settings',
  ]

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: blockedPaths,
      },
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Applebot', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'Googlebot', allow: '/' },
      { userAgent: 'Bingbot', allow: '/' },
      { userAgent: 'DuckDuckBot', allow: '/' },
      { userAgent: 'CCBot', allow: '/' },
    ],
    sitemap: [
      `${FOXING_BASE_URL}/sitemap.xml`,
      `${FOXING_BASE_URL}/llms.txt`,
    ],
    host: FOXING_BASE_URL,
  }
}
