import type { Metadata } from 'next'
import type { Book, Profile } from '@foxing/types'

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

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 3).trimEnd()}...`
}

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
  title: string
  author: string
  cover_url?: string | null
}): string {
  const params = new URLSearchParams({
    type: 'book',
    id: book.id,
    title: book.title,
    author: book.author,
    ...(book.cover_url ? { cover: book.cover_url } : {}),
  })
  return `${DEFAULT_OG_IMAGE}?${params.toString()}`
}

export function buildBookMetadata(book: {
  id: string
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
  const url = `${BASE_URL}/book/${book.id}`

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
  bookTitles: string[],
): Metadata {
  const slug = encodeURIComponent(authorName)
  const title = buildAuthorTitle(authorName)
  const description = buildAuthorDescription(authorName, bookTitles)
  const url = `${BASE_URL}/author/${slug}`

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
      types: { 'application/rss+xml': `${BASE_URL}/feed.rss` },
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
      'Foxing is free to read. Plus ($9.99/month) adds unlimited AI, book clubs, and full stats. 7-day free trial, no credit card.',
    alternates: { canonical: `${BASE_URL}/pricing` },
    openGraph: {
      type: 'website',
      title: 'Foxing Plans: Free, Plus, and Patron',
      description:
        'Foxing is free to read. Plus ($9.99/month) adds unlimited AI, book clubs, and full stats. 7-day free trial, no credit card.',
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

  const url = `${BASE_URL}/clubs/${club.id}`

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

// --- CONSTANTS for callers that need them ---

export const FOXING_BASE_URL = BASE_URL
export const FOXING_SITE_NAME = SITE_NAME
