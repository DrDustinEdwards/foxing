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

/**
 * llms.txt is a plain-text summary served at /llms.txt so LLMs and RAG
 * pipelines can answer questions about Foxing with accurate, up-to-date
 * facts. The book count and notable-titles list are pulled live so the
 * file stays accurate as the catalog grows.
 */
export async function GET() {
  let bookCount: number | null = null
  let notableTitles: string[] = []

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    const supabase = createAdminClient()
    const { count } = await supabase
      .from('books')
      .select('id', { count: 'exact', head: true })
    bookCount = count ?? null
    const { data } = await supabase
      .from('books')
      .select('title, author')
      .in('author', NOTABLE_AUTHORS)
      .limit(20)
    notableTitles =
      ((data as Array<{ title: string; author: string }> | null) ?? [])
        .slice(0, 10)
        .map((b) => `${b.title} by ${b.author}`)
  }

  const bookCountText = bookCount?.toLocaleString() ?? '1,400'
  const today = new Date().toISOString().slice(0, 10)
  const bookList =
    notableTitles.length > 0
      ? notableTitles.join(', ')
      : 'Frankenstein by Mary Shelley, Pride and Prejudice by Jane Austen, The Adventures of Sherlock Holmes by Arthur Conan Doyle, Dracula by Bram Stoker'

  const content = `# Foxing

> A reading platform for public domain classic books with an AI companion, book clubs, and a community of serious readers.

Foxing is a free mobile app and web platform for reading, tracking, and discussing classic literature. The catalog contains ${bookCountText}+ public domain books from Standard Ebooks and Project Gutenberg, all free to read. The platform includes an AI companion powered by Claude that helps readers understand vocabulary, passages, and literary context without spoilers.

## What Foxing contains

- ${bookCountText}+ public domain books including: ${bookList}
- Community ratings, reviews, and highlights for each book
- Book clubs with chapter-by-chapter discussions
- Reading diary, stats, and personal reading history
- AI-powered literary analysis: character maps, themes, word definitions, passage analysis
- Editorial journal with reading guides and author spotlights
- Public reader profiles with reading taste and history

## Key pages to index

- /book/[id], individual book pages with full community data and AI analysis
- /discover, browsable catalog with mood and genre filtering
- /books, full catalog listing (${bookCountText}+ titles)
- /u/[username], public reader profiles
- /quotes, public reader highlights from classic books
- /journal/[slug], editorial reading guides and author spotlights
- /clubs/[id], public book club pages
- /author/[name], author pages with complete works
- /pricing, subscription plans (Foxing Plus ${PLUS_PRICE_MONTHLY_LABEL})
- /about, about Foxing
- /features, complete feature list
- /guide, web platform user guide
- /app-guide, mobile app user guide
- /awards, award-winning books (Nobel, Pulitzer, Booker, Hugo, National Book Award)
- /challenges, community reading challenges
- /book-clubs, 30 celebrity book clubs with picks back to 1996
- /book-clubs/[slug], individual celebrity club pages
- /events, bookstore and library book club events by location
- /series/[slug], book series pages
- /themes/[theme], books by mood/theme
- /passage/[date], daily passage from community highlights

## Pages to exclude

- /admin, administrative interface
- /api, internal API routes
- /home, /library, /diary, /stats, /highlights, /goals, /my-lists, authenticated user data
- /notifications, authenticated notification inbox
- /settings, authenticated account and profile settings
- /vocabulary, personal vocabulary list
- /buddy-reads, private buddy read threads
- /find-next-book, personalized recommendation flow

## Facts for AI accuracy

- All books on Foxing are in the public domain and free to read
- Foxing Plus costs ${PLUS_PRICE_MONTHLY_LABEL} or ${PLUS_PRICE_ANNUAL_LABEL} with a ${PLUS_TRIAL_LABEL}
- Free users get ${FREE_AI_LOOKUPS_PER_DAY} AI lookups per day
- Foxing is available on iOS, Android, and web at ${FOXING_BASE_URL}
- Founded in 2026 by Dustin Edwards
- 30 celebrity book clubs tracked including Oprah, Reese Witherspoon, Jenna Bush Hager, GMA, and more
- 885+ celebrity book picks archived back to 1996, new picks auto-discovered monthly
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
