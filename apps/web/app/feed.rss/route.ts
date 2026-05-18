import { NextResponse, type NextRequest } from 'next/server'
import { fetchPublishedJournalPosts } from '@/lib/journal'
import { siteOrigin } from '@/lib/foxing'

export const revalidate = 3600

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

export async function GET(_request: NextRequest) {
  const origin = siteOrigin()
  const posts = await fetchPublishedJournalPosts(50)

  const items = posts
    .map((p) => {
      const url = `${origin}/journal/${p.slug}`
      const pub = rfc2822(p.published_at ?? p.created_at)
      const description = p.excerpt ?? ''
      return [
        '    <item>',
        `      <title>${xmlEscape(p.title)}</title>`,
        `      <link>${xmlEscape(url)}</link>`,
        `      <guid isPermaLink="true">${xmlEscape(url)}</guid>`,
        `      <pubDate>${pub}</pubDate>`,
        `      <description>${xmlEscape(description)}</description>`,
        ...(p.tags ?? []).map(
          (t) => `      <category>${xmlEscape(t)}</category>`,
        ),
        '    </item>',
      ].join('\n')
    })
    .join('\n')

  const lastBuild = posts[0]
    ? rfc2822(posts[0].published_at ?? posts[0].created_at)
    : new Date().toUTCString()

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>Foxing Journal</title>`,
    `    <link>${xmlEscape(`${origin}/journal`)}</link>`,
    `    <description>Essays on classic books, reading habits, and the craft of literature.</description>`,
    `    <language>en-us</language>`,
    `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
    `    <atom:link href="${xmlEscape(`${origin}/feed.rss`)}" rel="self" type="application/rss+xml" />`,
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
