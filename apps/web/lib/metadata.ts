import type { Metadata } from 'next'
import type { Book, Profile } from '@foxing/types'
import {
  PLUS_PRICE_COMBINED_LABEL,
  PLUS_TRIAL_LABEL,
} from '@/lib/config'
import { truncate } from '@/lib/strings'

/**
 * All metadata is dynamic. No hardcoded strings on a per-page basis. The
 * only constants are the site name, base URL, and tagline. Everything
 * else is derived from data. This file is the single source of truth
 * for page titles, descriptions, OG image URLs, and canonical URLs.
 *
 * Per metadata-architecture.md. Update lookup tables (MOOD/ERA/LENGTH)
 * here and every consumer reflects the change.
 */

const BASE_URL = 'https://foxing.app'
const SITE_NAME = 'Foxing'
const DEFAULT_OG_IMAGE = `${BASE_URL}/og`

const TITLE_MAX = 70
const DESCRIPTION_MAX = 160

// --- BOOK METADATA ---

export function buildBookTitle(book: Pick<Book, 'title' | 'author'>): string {
  return truncate(`${book.title} by ${book.author}`, TITLE_MAX)
}

export function buildBookDescription(book: {
  title: string
  author: string
  description?: string | null
  themes?: string[] | null
  word_count?: number | null
}): string {
  const parts: string[] = []
  if (book.description) {
    parts.push(book.description.replace(/\s+/g, ' ').trim().slice(0, 120))
  }
  if (book.themes && book.themes.length > 0) {
    parts.push(book.themes.slice(0, 2).join(', '))
  }
  parts.push('Read free on Foxing')
  return truncate(parts.join('. '), DESCRIPTION_MAX)
}

export function buildBookOgImageUrl(book: {
  id: string
  slug?: string | null
  title: string
  author: string
  cover_url?: string | null
}): string {
  const params = new URLSearchParams({
    type: 'book',
    id: book.id,
    title: book.title,
    author: book.author,
    ...(book.slug ? { slug: book.slug } : {}),
    ...(book.cover_url ? { cover: book.cover_url } : {}),
  })
  return `${DEFAULT_OG_IMAGE}?${params.toString()}`
}

export function buildBookMetadata(book: {
  id: string
  slug?: string | null
  title: string
  author: string
  description?: string | null
  themes?: string[] | null
  word_count?: number | null
  cover_url?: string | null
}): Metadata {
  const title = buildBookTitle(book)
  const description = buildBookDescription(book)
  const ogImage = buildBookOgImageUrl(book)
  const url = `${BASE_URL}/book/${book.slug ?? book.id}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'book',
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${book.title} by ${book.author}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

// --- AUTHOR METADATA ---

export function buildAuthorTitle(authorName: string): string {
  return truncate(`${authorName}, Complete Works`, TITLE_MAX)
}

export function buildAuthorDescription(
  authorName: string,
  bookTitles: string[],
): string {
  const titleList = bookTitles.slice(0, 3).join(', ')
  const more =
    bookTitles.length > 3 ? `, and ${bookTitles.length - 3} more` : ''
  const text = titleList
    ? `Read ${authorName} free on Foxing: ${titleList}${more}. AI-powered reading guides and community discussion.`
    : `Read ${authorName}'s complete works free on Foxing. AI companion, highlights, and book clubs.`
  return truncate(text, DESCRIPTION_MAX)
}

export function buildAuthorMetadata(
  authorName: string,
  authorSlug: string,
  bookTitles: string[],
): Metadata {
  const title = buildAuthorTitle(authorName)
  const description = buildAuthorDescription(authorName, bookTitles)
  const url = `${BASE_URL}/author/${authorSlug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: SITE_NAME,
    },
    twitter: { card: 'summary', title, description },
  }
}

// --- USER PROFILE METADATA ---

export function buildProfileTitle(
  profile: Pick<Profile, 'display_name' | 'username'>,
): string {
  return truncate(`${profile.display_name} (@${profile.username})`, TITLE_MAX)
}

export function buildProfileDescription(profile: {
  display_name: string
  username: string
  reading_personality?: string | null
  books_count?: number
}): string {
  const parts: string[] = []
  if (profile.reading_personality) parts.push(profile.reading_personality)
  if (profile.books_count && profile.books_count > 0) {
    parts.push(`${profile.books_count} books read on Foxing`)
  }
  if (parts.length === 0) {
    parts.push(`${profile.display_name}'s reading profile on Foxing`)
  }
  return truncate(parts.join('. '), DESCRIPTION_MAX)
}

export function buildProfileOgImageUrl(profile: {
  display_name: string
  reading_personality?: string | null
}): string {
  const params = new URLSearchParams({
    type: 'profile',
    name: profile.display_name,
    ...(profile.reading_personality
      ? { personality: profile.reading_personality }
      : {}),
  })
  return `${DEFAULT_OG_IMAGE}?${params.toString()}`
}

export function buildProfileMetadata(profile: {
  display_name: string
  username: string
  reading_personality?: string | null
  books_count?: number
}): Metadata {
  const title = buildProfileTitle(profile)
  const description = buildProfileDescription(profile)
  const ogImage = buildProfileOgImageUrl(profile)
  const url = `${BASE_URL}/u/${profile.username}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'profile',
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

// --- JOURNAL POST METADATA ---

export function buildJournalPostMetadata(post: {
  title: string
  slug: string
  excerpt?: string | null
  cover_image_url?: string | null
  published_at?: string | null
  author_name?: string | null
  tags?: string[] | null
}): Metadata {
  const title = truncate(post.title, TITLE_MAX)
  const description = truncate(
    post.excerpt ?? `${post.title}, from the Foxing Journal`,
    DESCRIPTION_MAX,
  )
  const url = `${BASE_URL}/journal/${post.slug}`
  const image = post.cover_image_url ?? `${DEFAULT_OG_IMAGE}?type=default`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: image, width: 1200, height: 630, alt: post.title }],
      publishedTime: post.published_at ?? undefined,
      authors: post.author_name ? [post.author_name] : ['Foxing'],
      tags: post.tags ?? undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

// --- BOOKS LISTING WITH FILTERS ---

const MOOD_LABELS: Record<string, { label: string; description: string }> = {
  dark: {
    label: 'Dark',
    description:
      'Dark, gothic, and unsettling classics. Frankenstein, Dracula, The Picture of Dorian Gray, and more.',
  },
  lighthearted: {
    label: 'Lighthearted',
    description:
      'Funny, warm, and uplifting classic books. Perfect when you need something cheerful.',
  },
  emotional: {
    label: 'Emotional',
    description:
      'Classic books that stay with you. Grief, love, loss, and the full range of human feeling.',
  },
  tense: {
    label: 'Tense',
    description:
      'Suspenseful classic novels. Mystery, danger, and edge-of-your-seat storytelling.',
  },
  hopeful: {
    label: 'Hopeful',
    description:
      'Classic books about resilience, redemption, and the possibility of a better world.',
  },
  funny: {
    label: 'Funny',
    description:
      "Comic classics: satire, wit, and genuine laughs from literature's best humorists.",
  },
  mysterious: {
    label: 'Mysterious',
    description:
      'Classic mysteries and detective fiction. Sherlock Holmes, Wilkie Collins, and more.',
  },
  adventurous: {
    label: 'Adventurous',
    description:
      'Classic adventure novels. Treasure Island, The Count of Monte Cristo, Robinson Crusoe.',
  },
  reflective: {
    label: 'Reflective',
    description:
      'Philosophical and introspective classics for careful, thoughtful reading.',
  },
  romantic: {
    label: 'Romantic',
    description:
      "Classic love stories. Jane Austen, the Brontes, and literature's great romances.",
  },
}

const ERA_LABELS: Record<string, { label: string; description: string }> = {
  'pre-1800': {
    label: 'Pre-1800 Classics',
    description:
      'The earliest classics: Shakespeare, Cervantes, Milton, Swift, Defoe, and more.',
  },
  '1800s': {
    label: '1800s Classics',
    description:
      'The great novels of the nineteenth century. Dickens, Tolstoy, Austen, Bronte, Hardy.',
  },
  'early-1900s': {
    label: 'Early 1900s',
    description:
      'Classic books from 1900 to 1950. Modernism, stream of consciousness, and the interwar period.',
  },
  'mid-1900s': {
    label: 'Mid-20th Century',
    description:
      'Classic novels from 1950 to 1970. The golden age of the novel in the postwar era.',
  },
}

const LENGTH_LABELS: Record<string, { label: string; description: string }> =
  {
    short: {
      label: 'Short Classics',
      description:
        'Classic books under 200 pages. Great for when you want a complete story without a long commitment.',
    },
    medium: {
      label: 'Medium Classics',
      description:
        'Classic novels between 200 and 400 pages. The ideal length for a weekend read.',
    },
    long: {
      label: 'Long Classics',
      description:
        'Epic classic novels over 400 pages. War and Peace, Middlemarch, Les Miserables, and more.',
    },
  }

export function buildBooksListingMetadata(params: {
  mood?: string
  era?: string
  length?: string
  genre?: string
  search?: string
  count?: number
}): Metadata {
  const { mood, era, length, genre, search, count } = params

  let title: string
  let description: string

  if (search) {
    title = `"${search}", Classic Books`
    description = `Classic books matching "${search}", free to read on Foxing.`
  } else if (mood && MOOD_LABELS[mood]) {
    title = `${MOOD_LABELS[mood].label} Classic Books`
    description = MOOD_LABELS[mood].description
  } else if (era && ERA_LABELS[era]) {
    title = ERA_LABELS[era].label
    description = ERA_LABELS[era].description
  } else if (length && LENGTH_LABELS[length]) {
    title = LENGTH_LABELS[length].label
    description = LENGTH_LABELS[length].description
  } else if (genre) {
    title = `${genre} Classics`
    description = `Classic ${genre.toLowerCase()} books, free to read on Foxing.`
  } else {
    title = count ? `Browse ${count}+ Classic Books` : 'Browse Classic Books'
    description =
      'Read 1,400+ public domain classic books free. Filter by mood, era, genre, and length.'
  }

  const urlParams = new URLSearchParams()
  if (mood) urlParams.set('mood', mood)
  if (era) urlParams.set('era', era)
  if (length) urlParams.set('length', length)
  if (genre) urlParams.set('genre', genre)
  if (search) urlParams.set('search', search)
  const canonical = `${BASE_URL}/books${
    urlParams.toString() ? `?${urlParams.toString()}` : ''
  }`

  // Index only the unfiltered page plus a single-filter view. Multi-filter
  // combinations produce thin content and dilute crawl budget.
  const activeFilterCount = (
    ['mood', 'era', 'length', 'genre', 'search'] as const
  ).filter((k) => params[k]).length
  const shouldIndex = !search && activeFilterCount <= 1

  return {
    title: truncate(title, TITLE_MAX),
    description: truncate(description, DESCRIPTION_MAX),
    alternates: { canonical },
    robots: shouldIndex
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type: 'website',
      title: truncate(title, TITLE_MAX),
      description: truncate(description, DESCRIPTION_MAX),
      url: canonical,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: truncate(title, TITLE_MAX),
      description: truncate(description, DESCRIPTION_MAX),
    },
  }
}

// --- DISCOVER PAGE ---

export function buildDiscoverMetadata(trendingTitles?: string[]): Metadata {
  const title = 'Discover Classic Books'
  const description =
    trendingTitles && trendingTitles.length > 0
      ? `Find your next classic. Readers are loving ${trendingTitles
          .slice(0, 2)
          .join(' and ')} this week. Browse 1,400+ free books.`
      : 'Find your next classic read. Browse 1,400+ free books by mood, genre, and era. See what readers are loving this week.'

  return {
    title,
    description: truncate(description, DESCRIPTION_MAX),
    alternates: { canonical: `${BASE_URL}/discover` },
    openGraph: {
      type: 'website',
      title,
      description: truncate(description, DESCRIPTION_MAX),
      url: `${BASE_URL}/discover`,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title,
      description: truncate(description, DESCRIPTION_MAX),
    },
  }
}

// --- STATIC PAGES (title only varies, rest is fixed) ---

export const STATIC_PAGE_METADATA: Record<string, Metadata> = {
  '/quotes': {
    title: 'Passages Readers Saved',
    description:
      'The most memorable lines from classic literature, saved and shared by Foxing readers.',
    alternates: { canonical: `${BASE_URL}/quotes` },
    openGraph: {
      type: 'website',
      title: 'Passages Readers Saved',
      description:
        'The most memorable lines from classic literature, saved and shared by Foxing readers.',
      url: `${BASE_URL}/quotes`,
      siteName: SITE_NAME,
    },
  },
  '/clubs': {
    title: 'Book Clubs for Classic Literature',
    description:
      'Join a reading club for Frankenstein, Sherlock Holmes, Jane Austen, and more. Chapter-by-chapter discussions.',
    alternates: { canonical: `${BASE_URL}/clubs` },
    openGraph: {
      type: 'website',
      title: 'Book Clubs for Classic Literature',
      description:
        'Join a reading club for Frankenstein, Sherlock Holmes, Jane Austen, and more. Chapter-by-chapter discussions.',
      url: `${BASE_URL}/clubs`,
      siteName: SITE_NAME,
    },
  },
  '/journal': {
    title: 'Journal',
    description:
      'Reading guides, author spotlights, and data from the Foxing community.',
    alternates: {
      canonical: `${BASE_URL}/journal`,
      types: { 'application/rss+xml': `${BASE_URL}/journal/rss.xml` },
    },
    openGraph: {
      type: 'website',
      title: 'Foxing Journal',
      description:
        'Reading guides, author spotlights, and data from the Foxing community.',
      url: `${BASE_URL}/journal`,
      siteName: SITE_NAME,
    },
  },
  '/about': {
    title: 'About',
    description:
      'Foxing is a reading platform for classic literature. 1,400+ free books, AI companion, and a community of serious readers.',
    alternates: { canonical: `${BASE_URL}/about` },
    openGraph: {
      type: 'website',
      title: 'About Foxing',
      description:
        'Foxing is a reading platform for classic literature. 1,400+ free books, AI companion, and a community of serious readers.',
      url: `${BASE_URL}/about`,
      siteName: SITE_NAME,
    },
  },
  '/pricing': {
    title: 'Plans',
    description:
      `Foxing is free to read. Plus (${PLUS_PRICE_COMBINED_LABEL}) adds unlimited AI, book club creation, and more. ${PLUS_TRIAL_LABEL}, no credit card.`,
    alternates: { canonical: `${BASE_URL}/pricing` },
    openGraph: {
      type: 'website',
      title: 'Foxing Plans: Free and Plus',
      description:
        `Foxing is free to read. Plus (${PLUS_PRICE_COMBINED_LABEL}) adds unlimited AI, book club creation, and more. ${PLUS_TRIAL_LABEL}, no credit card.`,
      url: `${BASE_URL}/pricing`,
      siteName: SITE_NAME,
    },
  },
  '/privacy': {
    title: 'Privacy Policy',
    description: 'How Foxing handles your data.',
    alternates: { canonical: `${BASE_URL}/privacy` },
    robots: { index: true, follow: true },
  },
  '/terms': {
    title: 'Terms of Service',
    description: 'Foxing terms of service.',
    alternates: { canonical: `${BASE_URL}/terms` },
    robots: { index: true, follow: true },
  },
  '/search': {
    title: 'Search',
    description: 'Search books, readers, and clubs on Foxing.',
    robots: { index: false, follow: true },
  },
  '/features': {
    title: 'What Foxing does',
    description:
      'Everything Foxing can do: 1,400+ free classic books, AI reading companion, book clubs, reading diary, vocabulary builder, and more.',
    alternates: { canonical: `${BASE_URL}/features` },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      title: 'What Foxing does',
      description:
        'Everything Foxing can do: 1,400+ free classic books, AI reading companion, book clubs, reading diary, vocabulary builder, and more.',
      url: `${BASE_URL}/features`,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: 'What Foxing does',
      description:
        'Everything Foxing can do: 1,400+ free classic books, AI reading companion, book clubs, reading diary, vocabulary builder, and more.',
    },
  },
  '/guide': {
    title: 'Using Foxing on the web',
    description:
      'How to use the Foxing web platform: your library, reading diary, stats, book clubs, vocabulary, and more.',
    alternates: { canonical: `${BASE_URL}/guide` },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      title: 'Using Foxing on the web',
      description:
        'How to use the Foxing web platform: your library, reading diary, stats, book clubs, vocabulary, and more.',
      url: `${BASE_URL}/guide`,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: 'Using Foxing on the web',
      description:
        'How to use the Foxing web platform: your library, reading diary, stats, book clubs, vocabulary, and more.',
    },
  },
  '/app-guide': {
    title: 'Using the Foxing app',
    description:
      'How to use the Foxing mobile app: reading, AI companion, highlights, tracking, book clubs, and settings.',
    alternates: { canonical: `${BASE_URL}/app-guide` },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      title: 'Using the Foxing app',
      description:
        'How to use the Foxing mobile app: reading, AI companion, highlights, tracking, book clubs, and settings.',
      url: `${BASE_URL}/app-guide`,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: 'Using the Foxing app',
      description:
        'How to use the Foxing mobile app: reading, AI companion, highlights, tracking, book clubs, and settings.',
    },
  },
}

// --- QUOTE METADATA ---

export function buildQuoteMetadata(quote: {
  id: string
  text: string
  book_title: string
  book_author: string
  username: string
}): Metadata {
  const excerpt =
    quote.text.length > 80 ? `${quote.text.slice(0, 77)}...` : quote.text
  const title = truncate(`"${excerpt}", ${quote.book_title}`, TITLE_MAX)
  const description = truncate(
    `From ${quote.book_title} by ${quote.book_author}, saved by @${quote.username} on Foxing.`,
    DESCRIPTION_MAX,
  )
  const url = `${BASE_URL}/quotes/${quote.id}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: SITE_NAME,
    },
    twitter: { card: 'summary', title, description },
  }
}

// --- CLUB METADATA ---

export function buildClubMetadata(club: {
  id: string
  slug?: string | null
  name: string
  description?: string | null
  current_book_title?: string | null
  current_book_author?: string | null
  member_count?: number
}): Metadata {
  const title = truncate(club.name, TITLE_MAX)
  let description: string

  if (club.current_book_title && club.current_book_author) {
    description = `Currently reading ${club.current_book_title} by ${club.current_book_author}.`
    if (club.description) description += ` ${club.description.slice(0, 80)}`
    if (club.member_count) description += ` ${club.member_count} members.`
  } else if (club.description) {
    description = club.description
  } else {
    description = `A book club on Foxing${
      club.member_count ? ` with ${club.member_count} members` : ''
    }.`
  }

  const url = `${BASE_URL}/clubs/${club.slug ?? club.id}`

  return {
    title,
    description: truncate(description, DESCRIPTION_MAX),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title,
      description: truncate(description, DESCRIPTION_MAX),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title,
      description: truncate(description, DESCRIPTION_MAX),
    },
  }
}

export function buildClubLibraryMetadata(club: {
  id: string
  slug?: string | null
  name: string
  book_count: number
}): Metadata {
  const title = truncate(`${club.name} library`, TITLE_MAX)
  const description = truncate(
    `${club.book_count} ${
      club.book_count === 1 ? 'book' : 'books'
    } this club has read together on Foxing.`,
    DESCRIPTION_MAX,
  )
  const url = `${BASE_URL}/clubs/${club.slug ?? club.id}/library`
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: false, follow: true },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: SITE_NAME,
    },
    twitter: { card: 'summary', title, description },
  }
}

// --- CONSTANTS for callers that need them ---

export const FOXING_BASE_URL = BASE_URL
export const FOXING_SITE_NAME = SITE_NAME

// ---------------------------------------------------------------------------
// Extras: metadata helpers for /people, /series, /awards, /challenges,
// /themes, /lists, /passage, /year, /vocabulary, /buddy-reads, plus user
// sub-pages (library, diary, lists, highlights, reviews). All build the
// same Metadata shape and reuse the truncate/TITLE_MAX/DESCRIPTION_MAX
// utilities above so there is one source of truth for clamps.
// ---------------------------------------------------------------------------

function clampTitle(s: string): string {
  return truncate(s, TITLE_MAX)
}

function clampDescription(s: string): string {
  return truncate(s, DESCRIPTION_MAX)
}

function formatHumanDate(isoDate: string): string {
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  const d = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// --- /people ---

export function buildPeopleMetadata(): Metadata {
  const title = 'Readers on Foxing'
  const description =
    'Find readers with similar taste on Foxing. See what serious readers of classic literature are reading.'
  const url = `${BASE_URL}/people`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

// --- /series index + /series/[slug] ---

export function buildSeriesIndexMetadata(): Metadata {
  const title = 'Book Series on Foxing'
  const description =
    'Classic book series in reading order. Sherlock Holmes, Jeeves, Tarzan, and more, free on Foxing.'
  const url = `${BASE_URL}/series`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

export function buildSeriesMetadata(opts: {
  slug: string
  seriesName: string
  bookCount: number
  firstBook?: string
  lastBook?: string
}): Metadata {
  const title = `${opts.seriesName}, Reading Order on Foxing`
  const range =
    opts.firstBook && opts.lastBook
      ? `${opts.firstBook} to ${opts.lastBook}.`
      : ''
  const description = `Read ${opts.seriesName} in order. All ${opts.bookCount} books free on Foxing. ${range}`.trim()
  const url = `${BASE_URL}/series/${opts.slug}`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

// --- /awards ---

export function buildAwardsMetadata(): Metadata {
  const title = 'Award-Winning Classic Books'
  const description =
    'Nobel Prize, Pulitzer, Booker, and Hugo Award winners available free on Foxing.'
  const url = `${BASE_URL}/awards`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

// --- /challenges ---

export function buildChallengesIndexMetadata(): Metadata {
  const title = 'Reading Challenges on Foxing'
  const description =
    'Join community reading challenges on Foxing. Read classic books alongside thousands of other readers.'
  const url = `${BASE_URL}/challenges`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

// --- /themes/[theme] ---

export interface ThemeDefinition {
  name: string
  description: string
  searchTerms: string[]
}

export const THEME_DEFINITIONS: Record<string, ThemeDefinition> = {
  'unreliable-narrators': {
    name: 'Unreliable Narrators',
    description:
      'Books told by narrators you cannot quite trust. The uncertainty is the point.',
    searchTerms: ['unreliable', 'narrator'],
  },
  epistolary: {
    name: 'Epistolary Novels',
    description:
      'Stories told through letters, diary entries, and documents.',
    searchTerms: ['epistolary', 'letters', 'diary'],
  },
  gothic: {
    name: 'Gothic Literature',
    description: 'Dark atmosphere, crumbling estates, and the uncanny.',
    searchTerms: ['gothic', 'horror', 'supernatural'],
  },
  revenge: {
    name: 'Revenge',
    description: 'The Count of Monte Cristo and its literary cousins.',
    searchTerms: ['revenge'],
  },
  survival: {
    name: 'Survival',
    description:
      'Characters pushed to their limits by nature, society, or circumstance.',
    searchTerms: ['survival', 'wilderness', 'castaway'],
  },
  'coming-of-age': {
    name: 'Coming of Age',
    description: 'The transition from youth to adulthood, in every era.',
    searchTerms: ['coming-of-age', 'bildungsroman', 'youth'],
  },
  'social-satire': {
    name: 'Social Satire',
    description:
      'Literature that holds a mirror to society and finds it wanting.',
    searchTerms: ['satire', 'social', 'class'],
  },
  detective: {
    name: 'Detective Fiction',
    description:
      'From Sherlock Holmes to Hercule Poirot. The puzzle and the solution.',
    searchTerms: ['detective', 'mystery', 'crime'],
  },
  adventure: {
    name: 'Adventure',
    description:
      'Treasure islands, lost worlds, and journeys into the unknown.',
    searchTerms: ['adventure', 'exploration', 'treasure'],
  },
  war: {
    name: 'War Literature',
    description:
      'Books that take war seriously, its cost, its meaning, its aftermath.',
    searchTerms: ['war', 'battle', 'military'],
  },
  adventurous: {
    name: 'Adventurous',
    description: 'Quests, voyages, and characters who keep moving.',
    searchTerms: ['adventurous'],
  },
  dark: {
    name: 'Dark',
    description:
      'Bleak settings, hard endings, and characters under pressure.',
    searchTerms: ['dark'],
  },
  emotional: {
    name: 'Emotional',
    description: 'Books that work on grief, love, loss, and joy.',
    searchTerms: ['emotional'],
  },
  funny: {
    name: 'Funny',
    description: 'Wit, absurdity, and timing. Books that earn the laugh.',
    searchTerms: ['funny'],
  },
  hopeful: {
    name: 'Hopeful',
    description:
      'Books that believe in something. A measure of light against the dark.',
    searchTerms: ['hopeful'],
  },
  lighthearted: {
    name: 'Lighthearted',
    description: 'Easy company on the page. Warmth without weight.',
    searchTerms: ['lighthearted'],
  },
  mysterious: {
    name: 'Mysterious',
    description: 'Secrets withheld and slowly revealed.',
    searchTerms: ['mysterious'],
  },
  reflective: {
    name: 'Reflective',
    description: 'Inward-facing books. Long looks at one life, one question.',
    searchTerms: ['reflective'],
  },
  romantic: {
    name: 'Romantic',
    description: 'Love as the central question, and what comes after.',
    searchTerms: ['romantic'],
  },
  tense: {
    name: 'Tense',
    description: 'Pages that pull tight. You read faster than you mean to.',
    searchTerms: ['tense'],
  },
}

export function buildThemeMetadata(slug: string): Metadata {
  const theme = THEME_DEFINITIONS[slug]
  if (!theme) {
    return {
      title: 'Theme not found',
      robots: { index: false, follow: true },
    }
  }
  const title = `${theme.name}, Classic Books on Foxing`
  const description = `${theme.description} All free to read on Foxing.`
  const url = `${BASE_URL}/themes/${slug}`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

// --- /lists (public reading lists index) ---

export function buildListsIndexMetadata(): Metadata {
  const title = 'Reading Lists on Foxing'
  const description =
    'Curated classic book lists from serious readers. Victorian novels, gothic horror, and more.'
  const url = `${BASE_URL}/lists`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

// --- /book-clubs/picks ---

export function buildPicksIndexMetadata(): Metadata {
  const title = 'Every Book Club Pick, Searchable'
  const description =
    'Search and filter every celebrity book club pick by year, club, and era. Oprah, Reese, Jenna, GMA, and more, rated by Foxing readers.'
  const url = `${BASE_URL}/book-clubs/picks`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

// --- /passage/[date] ---

export function buildPassageMetadata(passage: {
  date: string
  excerpt: string
  bookTitle: string
  bookAuthor: string
  username?: string | null
}): Metadata {
  const trimmed = passage.excerpt.replace(/\s+/g, ' ').trim()
  const safeExcerpt =
    trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed
  const formattedDate = formatHumanDate(passage.date)
  const title = `"${safeExcerpt}", Passage of the Day`
  const description = `From ${passage.bookTitle} by ${passage.bookAuthor}. ${formattedDate}.`
  const url = `${BASE_URL}/passage/${passage.date}`

  const ogParams = new URLSearchParams({
    type: 'quote',
    text: safeExcerpt,
    book: passage.bookTitle,
    author: passage.bookAuthor,
  })
  const ogImage = `${DEFAULT_OG_IMAGE}?${ogParams.toString()}`

  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: clampTitle(title),
      description: clampDescription(description),
      images: [ogImage],
    },
  }
}

// --- USER SUB-PAGES ---

interface ProfileBasics {
  display_name: string
  username: string
}

export function buildUserLibraryMetadata(
  profile: ProfileBasics & {
    books_count?: number
    currently_reading_title?: string | null
  },
): Metadata {
  const title = `${profile.display_name}'s Books`
  let description = `${profile.display_name}'s reading shelf on Foxing`
  if (profile.books_count && profile.books_count > 0) {
    description += `. ${profile.books_count} books`
  }
  if (profile.currently_reading_title) {
    description += `. Currently reading ${profile.currently_reading_title}.`
  } else {
    description += '.'
  }
  const url = `${BASE_URL}/u/${profile.username}/library`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

export function buildUserDiaryMetadata(
  profile: ProfileBasics & { entry_count?: number },
): Metadata {
  const title = `${profile.display_name}'s Reading Diary`
  const description = profile.entry_count
    ? `${profile.display_name}'s reading diary on Foxing. ${profile.entry_count} entries.`
    : `${profile.display_name}'s reading diary on Foxing.`
  const url = `${BASE_URL}/u/${profile.username}/diary`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

export function buildDiaryEntryMetadata(entry: {
  id: string
  slug?: string | null
  username: string
  display_name: string
  book_title: string
  book_author: string
  log_date: string
  rating?: number | null
  review?: string | null
  book_cover_url?: string | null
}): Metadata {
  const formatted = formatHumanDate(entry.log_date)
  const ratingText = entry.rating ? ` ${entry.rating}/5` : ''
  const title = `${entry.display_name} on ${entry.book_title}`
  const description = entry.review
    ? `${entry.display_name} read ${entry.book_title} by ${entry.book_author}${ratingText}. ${entry.review
        .replace(/\s+/g, ' ')
        .slice(0, 100)}`
    : `${entry.display_name} read ${entry.book_title} by ${entry.book_author}${ratingText} on ${formatted}.`
  const ogParams = new URLSearchParams({
    type: 'diary',
    name: entry.display_name,
    book: entry.book_title,
    author: entry.book_author,
    ...(ratingText ? { rating: ratingText.trim() } : {}),
    ...(entry.book_cover_url ? { cover: entry.book_cover_url } : {}),
  })
  const ogImage = `${DEFAULT_OG_IMAGE}?${ogParams.toString()}`
  const url = `${BASE_URL}/u/${entry.username}/diary/${entry.slug ?? entry.id}`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: clampTitle(title),
      description: clampDescription(description),
      images: [ogImage],
    },
  }
}

export function buildUserListsMetadata(
  profile: ProfileBasics & { list_count?: number },
): Metadata {
  const title = `${profile.display_name}'s Reading Lists`
  const description = profile.list_count
    ? `${profile.display_name} has ${profile.list_count} curated reading lists on Foxing.`
    : `${profile.display_name}'s curated reading lists on Foxing.`
  const url = `${BASE_URL}/u/${profile.username}/lists`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

export function buildReadingListMetadata(list: {
  id: string
  slug?: string | null
  title: string
  description?: string | null
  username: string
  display_name: string
  book_count?: number
  book_titles?: string[]
  cover_urls?: string[]
}): Metadata {
  const title = list.title
  let description: string
  if (list.description) {
    description = `${list.description.replace(/\s+/g, ' ').slice(0, 100)}, a reading list by ${list.display_name}.`
  } else if (list.book_titles && list.book_titles.length > 0) {
    const sample = list.book_titles.slice(0, 3).join(', ')
    const remaining = (list.book_count ?? list.book_titles.length) - 3
    const more = remaining > 0 ? ` and ${remaining} more` : ''
    description = `${sample}${more}, a reading list by ${list.display_name} on Foxing.`
  } else {
    description = `A reading list by ${list.display_name} on Foxing.`
  }

  const ogParams = new URLSearchParams({
    type: 'list',
    title: list.title,
    creator: list.display_name,
    ...(list.book_count ? { count: String(list.book_count) } : {}),
    ...(list.cover_urls && list.cover_urls[0]
      ? { cover: list.cover_urls[0] }
      : {}),
  })
  const ogImage = `${DEFAULT_OG_IMAGE}?${ogParams.toString()}`
  const url = `${BASE_URL}/u/${list.username}/lists/${list.slug ?? list.id}`

  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: clampTitle(title),
      description: clampDescription(description),
      images: [ogImage],
    },
  }
}

export function buildUserHighlightsMetadata(
  profile: ProfileBasics & { highlight_count?: number },
): Metadata {
  const title = `${profile.display_name}'s Highlights`
  const description = profile.highlight_count
    ? `${profile.display_name} has saved ${profile.highlight_count} passages from classic books on Foxing.`
    : `Passages ${profile.display_name} has saved from classic books on Foxing.`
  const url = `${BASE_URL}/u/${profile.username}/highlights`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

export function buildUserReviewsMetadata(
  profile: ProfileBasics & { review_count?: number },
): Metadata {
  const title = `${profile.display_name}'s Reviews`
  const description = profile.review_count
    ? `${profile.display_name} has reviewed ${profile.review_count} books on Foxing.`
    : `${profile.display_name}'s book reviews on Foxing.`
  const url = `${BASE_URL}/u/${profile.username}/reviews`
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

// --- /year/[year] ---

export function buildYearInReadingMetadata(opts: {
  username?: string
  display_name?: string
  year: number
  books_count?: number
  pages_count?: number
  top_genre?: string | null
}): Metadata {
  const isPublic = Boolean(opts.username && opts.display_name)
  const title = isPublic
    ? `${opts.display_name}'s ${opts.year} in Reading`
    : `Your ${opts.year} in Reading`
  const parts: string[] = []
  if (opts.books_count) parts.push(`${opts.books_count} books read in ${opts.year}`)
  if (opts.pages_count) parts.push(`${opts.pages_count.toLocaleString()} pages`)
  if (opts.top_genre) parts.push(`Top genre: ${opts.top_genre}`)
  const description =
    parts.length > 0
      ? parts.join('. ') + '.'
      : `A reading recap for ${opts.year}, made on Foxing.`
  const url = isPublic
    ? `${BASE_URL}/u/${opts.username}/year/${opts.year}`
    : `${BASE_URL}/year/${opts.year}`
  if (!isPublic) {
    return {
      title: clampTitle(title),
      description: clampDescription(description),
      robots: { index: false, follow: false },
    }
  }
  return {
    title: clampTitle(title),
    description: clampDescription(description),
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: clampTitle(title),
      description: clampDescription(description),
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary',
      title: clampTitle(title),
      description: clampDescription(description),
    },
  }
}

// --- /vocabulary, /buddy-reads (private user pages) ---

export const VOCABULARY_METADATA: Metadata = {
  title: 'Your Vocabulary',
  description: "Words you've looked up while reading classic books on Foxing.",
  robots: { index: false, follow: false },
}

export const BUDDY_READS_METADATA: Metadata = {
  title: 'Buddy reads',
  description: 'Read a classic with one other person.',
  robots: { index: false, follow: false },
}
