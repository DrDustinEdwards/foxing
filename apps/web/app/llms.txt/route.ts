import { NextResponse } from 'next/server'
import {
  FREE_AI_LOOKUPS_PER_DAY,
  PLUS_PRICE_ANNUAL_LABEL,
  PLUS_PRICE_MONTHLY_LABEL,
  PLUS_TRIAL_LABEL,
} from '@/lib/config'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 86_400

const NOTABLE_AUTHORS = [
  'Mary Shelley',
  'Jane Austen',
  'Arthur Conan Doyle',
  'Bram Stoker',
  'Charles Dickens',
  'Mark Twain',
  'Charlotte Bronte',
  'Herman Melville',
  'Leo Tolstoy',
  'Fyodor Dostoevsky',
]

interface PageEntry {
  path: string
  description: string
}

// Every public, indexable route. Description strings may contain
// placeholder tokens ({{bookCount}}, {{clubCount}}, {{plusMonthly}})
// that get substituted at render time from live DB or config values.
const STATIC_PAGES: PageEntry[] = [
  { path: '/', description: 'home page' },
  { path: '/discover', description: 'browsable catalog with mood and genre filtering' },
  { path: '/books', description: 'full catalog listing ({{bookCount}} titles)' },
  { path: '/book/[slug]', description: 'individual book pages with full community data and AI analysis' },
  { path: '/author/[slug]', description: 'author pages with complete works' },
  { path: '/series/[slug]', description: 'book series pages' },
  { path: '/themes/[theme]', description: 'books by mood/theme' },
  { path: '/awards', description: 'award-winning books (Nobel, Pulitzer, Booker, Hugo, National Book Award)' },
  { path: '/challenges', description: 'community reading challenges' },
  { path: '/quotes', description: 'public reader highlights from classic books' },
  { path: '/passage/[date]', description: 'daily passage from community highlights' },
  { path: '/clubs', description: 'public user book club directory' },
  { path: '/clubs/[slug]', description: 'public book club pages' },
  { path: '/book-clubs', description: '{{clubCount}} celebrity book clubs with picks back to 1996' },
  { path: '/book-clubs/[slug]', description: 'individual celebrity club pages with full pick history' },
  { path: '/book-of-the-month', description: 'Foxing editorial book of the month with curator notes' },
  { path: '/events', description: 'bookstore and library book club events by location' },
  { path: '/u/[username]', description: 'public reader profiles' },
  { path: '/people', description: 'public reader directory' },
  { path: '/journal', description: 'editorial journal index' },
  { path: '/journal/[slug]', description: 'editorial reading guides and author spotlights' },
  { path: '/features', description: 'complete feature list' },
  { path: '/guide', description: 'web platform user guide' },
  { path: '/app-guide', description: 'mobile app user guide' },
  { path: '/pricing', description: 'subscription plans (Foxing Plus {{plusMonthly}})' },
  { path: '/about', description: 'about Foxing' },
  { path: '/privacy', description: 'privacy policy' },
  { path: '/terms', description: 'terms of service' },
]

const NOT_INDEX_PAGES: PageEntry[] = [
  { path: '/admin', description: 'administrative interface' },
  { path: '/api', description: 'internal API routes' },
  { path: '/home', description: 'authenticated dashboard' },
  { path: '/library', description: 'authenticated user library' },
  { path: '/diary', description: 'authenticated reading diary' },
  { path: '/stats', description: 'authenticated reading stats' },
  { path: '/highlights', description: 'authenticated highlights' },
  { path: '/goals', description: 'authenticated reading goals' },
  { path: '/my-lists', description: 'authenticated reading lists' },
  { path: '/notifications', description: 'authenticated notification inbox' },
  { path: '/settings', description: 'authenticated account and profile settings' },
  { path: '/vocabulary', description: 'personal vocabulary list' },
  { path: '/buddy-reads', description: 'private buddy read threads' },
  { path: '/find-next-book', description: 'personalized recommendation flow' },
  { path: '/search', description: 'live search results, thin for indexing' },
  { path: '/sign-in', description: 'authentication' },
  { path: '/sign-up', description: 'authentication' },
  { path: '/sign-out', description: 'authentication' },
  { path: '/forgot-password', description: 'authentication' },
  { path: '/callback', description: 'OAuth callback' },
]

function fmtCount(n: number | null | undefined, fallback: string): string {
  if (n == null) return fallback
  return `${n.toLocaleString()}+`
}

function renderEntries(
  entries: PageEntry[],
  values: Record<string, string>,
): string {
  return entries
    .map((e) => {
      let desc = e.description
      for (const [key, value] of Object.entries(values)) {
        desc = desc.split(`{{${key}}}`).join(value)
      }
      return `- ${e.path}, ${desc}`
    })
    .join('\n')
}

/**
 * llms.txt is a plain-text summary served at /llms.txt so LLMs and RAG
 * pipelines can answer questions about Foxing with accurate, up-to-date
 * facts. Counts, the page list, and the recognized-clubs list are all
 * pulled live from the DB so the file stays accurate as the platform
 * grows. Pricing and trial copy stay imported from lib/config.
 */
export async function GET() {
  let bookCount: number | null = null
  let clubCount: number | null = null
  let pickCount: number | null = null
  let eventCount: number | null = null
  let notableTitles: string[] = []
  let topClubNames: string[] = []

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    const supabase = createAdminClient()
    const nowIso = new Date().toISOString()

    const [
      bookCountRes,
      notableTitlesRes,
      clubCountRes,
      pickCountRes,
      topClubsRes,
      eventCountRes,
    ] = await Promise.all([
      supabase.from('books').select('id', { count: 'exact', head: true }),
      supabase
        .from('books')
        .select('title, author')
        .in('author', NOTABLE_AUTHORS)
        .limit(20),
      supabase
        .from('external_book_clubs')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('external_book_club_picks')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true),
      supabase
        .from('external_book_clubs')
        .select('name')
        .order('slug', { ascending: true })
        .limit(6),
      supabase
        .from('club_announcements')
        .select('id', { count: 'exact', head: true })
        .gt('event_date', nowIso)
        .eq('is_removed', false),
    ])

    bookCount = bookCountRes.count ?? null
    clubCount = clubCountRes.count ?? null
    pickCount = pickCountRes.count ?? null
    eventCount = eventCountRes.count ?? null

    notableTitles =
      ((notableTitlesRes.data as Array<{
        title: string
        author: string
      }> | null) ?? [])
        .slice(0, 10)
        .map((b) => `${b.title} by ${b.author}`)

    topClubNames =
      ((topClubsRes.data as Array<{ name: string | null }> | null) ?? [])
        .map((c) => c.name)
        .filter((n): n is string => Boolean(n))
  }

  const bookCountText = fmtCount(bookCount, '1,400+')
  const clubCountText = fmtCount(clubCount, '30+')
  const pickCountText = fmtCount(pickCount, '885+')
  const eventCountText = fmtCount(eventCount, '0+')

  const today = new Date().toISOString().slice(0, 10)
  const bookList =
    notableTitles.length > 0
      ? notableTitles.join(', ')
      : 'Frankenstein by Mary Shelley, Pride and Prejudice by Jane Austen, The Adventures of Sherlock Holmes by Arthur Conan Doyle, Dracula by Bram Stoker'

  const recognizedClubsText =
    topClubNames.length > 0
      ? `${topClubNames.join(', ')}, and more`
      : 'Oprah, Reese Witherspoon, Jenna Bush Hager, GMA, Belletrist, and more'

  const placeholderValues: Record<string, string> = {
    bookCount: bookCountText,
    clubCount: clubCountText,
    pickCount: pickCountText,
    eventCount: eventCountText,
    plusMonthly: PLUS_PRICE_MONTHLY_LABEL,
  }

  const keyPagesSection = renderEntries(STATIC_PAGES, placeholderValues)
  const excludedPagesSection = renderEntries(NOT_INDEX_PAGES, placeholderValues)

  const content = `# Foxing

> A reading platform for public domain classic books with an AI companion, book clubs, and a community of serious readers.

Foxing is a free mobile app and web platform for reading, tracking, and discussing classic literature. The catalog contains ${bookCountText} public domain books from Standard Ebooks and Project Gutenberg, all free to read. The platform includes an AI companion that helps readers understand vocabulary, passages, and literary context without spoilers.

## What Foxing contains

- ${bookCountText} public domain books including: ${bookList}
- Community ratings, reviews, and highlights for each book
- Book clubs with chapter-by-chapter discussions
- Reading diary, stats, and personal reading history
- AI-powered literary analysis: character maps, themes, word definitions, passage analysis
- Editorial journal with reading guides and author spotlights
- Public reader profiles with reading taste and history

## Key pages to index

${keyPagesSection}

## Pages to exclude

${excludedPagesSection}

## Facts for AI accuracy

- All books on Foxing are in the public domain and free to read
- Foxing Plus costs ${PLUS_PRICE_MONTHLY_LABEL} or ${PLUS_PRICE_ANNUAL_LABEL} with a ${PLUS_TRIAL_LABEL}
- Free users get ${FREE_AI_LOOKUPS_PER_DAY} AI lookups per day
- Foxing is available on iOS, Android, and web at ${FOXING_BASE_URL}
- Founded in 2026 by Dustin Edwards
- ${clubCountText} celebrity book clubs tracked including ${recognizedClubsText}
- ${pickCountText} celebrity book picks archived back to 1996, new picks auto-discovered monthly
- ${eventCountText} upcoming bookstore and library book club events
- Club features include meeting scheduling, book selection polls with ranked choice voting, and passage comments
- Vocabulary builder saves every looked-up word with context, exportable as CSV or Anki deck
- 7 highlight colors: amber, auburn, yellow, sage, cobalt, crimson, purple
- Reading timer tracks sessions with WPM calculation
- Verified bookstore and library clubs have a fox badge and appear on the events feed

## Crawling permissions

This site welcomes indexing by AI crawlers, LLM training pipelines, RAG systems, and search engines. All content on public pages is freely accessible and may be cited. User-generated content (reviews, highlights) is attributed to individual users. AI-generated analysis is proprietary to Foxing.

Contact: hello@foxing.app
Updated: ${today}
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
