import type { Metadata } from 'next'
import { FOXING_BASE_URL, FOXING_SITE_NAME } from '@/lib/metadata'

/**
 * Metadata helpers for the missing-pages task. Kept in a separate module
 * so the parallel SEO terminal can keep editing `metadata.ts` without
 * causing merge conflicts. Consumers can keep importing from either file.
 */

const BASE_URL = FOXING_BASE_URL
const SITE_NAME = FOXING_SITE_NAME
const OG_ROUTE = `${BASE_URL}/og`
const TITLE_MAX = 70
const DESCRIPTION_MAX = 160

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 3).trimEnd()}...`
}

function clampTitle(s: string): string {
  return truncate(s, TITLE_MAX)
}

function clampDescription(s: string): string {
  return truncate(s, DESCRIPTION_MAX)
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

// --- /lists ---

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
  const ogImage = `${OG_ROUTE}?${ogParams.toString()}`

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
  const ogImage = `${OG_ROUTE}?${ogParams.toString()}`
  const url = `${BASE_URL}/u/${entry.username}/diary/${entry.id}`
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
  const ogImage = `${OG_ROUTE}?${ogParams.toString()}`
  const url = `${BASE_URL}/u/${list.username}/lists/${list.id}`

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

// --- /vocabulary, /buddy-reads ---

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

// --- HELPERS shared with pages ---

export function slugifySeriesName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
