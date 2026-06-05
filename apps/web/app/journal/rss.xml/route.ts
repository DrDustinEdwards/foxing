import { NextResponse } from 'next/server'
import { getJournalPostsStatic } from '@/lib/journal'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 3600
export const dynamic = 'force-static'

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function rfc2822(iso: string | null): string {
  if (!iso) return new Date().toUTCString()
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return new Date().toUTCString()
  return d.toUTCString()
}

export async function GET() {
  const posts = await getJournalPostsStatic(50)

  const items = posts
    .map((post) => {
      const url = `${FOXING_BASE_URL}/journal/${post.slug}`
      return [
        '    <item>',
        `      <title>${xmlEscape(post.title)}</title>`,
        `      <link>${xmlEscape(url)}</link>`,
        `      <guid isPermaLink="true">${xmlEscape(url)}</guid>`,
        `      <pubDate>${rfc2822(post.published_at)}</pubDate>`,
        `      <author>hello@foxing.app (Foxing)</author>`,
        `      <description>${xmlEscape(post.excerpt ?? '')}</description>`,
        ...post.tags.map(
          (t) => `      <category>${xmlEscape(t)}</category>`,
        ),
        '    </item>',
      ].join('\n')
    })
    .join('\n')

  const lastBuild = posts[0]
    ? rfc2822(posts[0].published_at)
    : new Date().toUTCString()

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>Foxing Journal</title>`,
    `    <link>${xmlEscape(`${FOXING_BASE_URL}/journal`)}</link>`,
    `    <description>Reading guides, book picks, author spotlights, and literary analysis from Foxing.</description>`,
    `    <language>en-us</language>`,
    `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
    `    <atom:link href="${xmlEscape(`${FOXING_BASE_URL}/journal/rss.xml`)}" rel="self" type="application/rss+xml" />`,
    items,
    '  </channel>',
    '</rss>',
  ].join('\n')

  return new NextResponse(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
