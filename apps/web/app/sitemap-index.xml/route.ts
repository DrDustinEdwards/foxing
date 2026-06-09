import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 86400
export const dynamic = 'force-static'

const SITEMAPS = [
  '/sitemap.xml',
  '/journal/sitemap.xml',
  '/book/sitemap.xml',
  '/author/sitemap.xml',
  '/series/sitemap.xml',
  '/themes/sitemap.xml',
  '/book-clubs/sitemap.xml',
  '/book-of-the-month/sitemap.xml',
  '/clubs/sitemap.xml',
  '/events/sitemap.xml',
  '/lists/sitemap.xml',
  '/u/sitemap.xml',
  '/quotes/sitemap.xml',
  '/passage/sitemap.xml',
]

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const now = new Date().toISOString()
  const items = SITEMAPS.map(
    (p) =>
      `  <sitemap><loc>${xmlEscape(`${FOXING_BASE_URL}${p}`)}</loc><lastmod>${now}</lastmod></sitemap>`,
  ).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>`
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
