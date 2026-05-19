import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchEventStates } from '@/lib/events'
import { FOXING_BASE_URL, slugifySeriesName } from '@/lib/metadata'

export const revalidate = 3600

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
 * Dynamic sitemap. Lists every public URL Foxing wants Google to index:
 * static marketing pages, public profiles, the catalog, the journal,
 * public clubs, and unique authors.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
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

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return staticPages
  }

  const supabase = createAdminClient()

  const [
    booksRes,
    profilesRes,
    journalRes,
    clubsRes,
    listsRes,
    celebrityPicksRes,
    externalClubsRes,
    seriesRes,
  ] = await Promise.all([
    supabase
      .from('books')
      .select('id, slug, author_slug, updated_at, created_at')
      .order('title', { ascending: true })
      .limit(2000),
    supabase
      .from('profiles')
      .select('username, updated_at, created_at')
      .eq('is_public', true)
      .limit(10_000),
    supabase
      .from('journal_posts')
      .select('slug, updated_at, published_at')
      .eq('is_published', true),
    supabase
      .from('clubs')
      .select('id, slug, updated_at, created_at')
      .eq('visibility', 'public')
      .limit(1000),
    supabase
      .from('reading_lists')
      .select('id, slug, updated_at, created_at, profiles:user_id(username)')
      .eq('is_public', true)
      .limit(2000),
    supabase
      .from('external_book_club_picks')
      .select(
        'pick_month, pick_year, external_book_clubs:club_id(slug)',
      )
      .eq('is_published', true),
    supabase
      .from('external_book_clubs')
      .select('slug')
      .limit(200),
    supabase
      .from('books')
      .select('series_name')
      .not('series_name', 'is', null)
      .limit(5000),
  ])

  const bookRows = (booksRes.data as Array<{
    id: string
    slug: string | null
    author_slug: string | null
    updated_at: string | null
    created_at: string
  }> | null) ?? []

  const bookPages: MetadataRoute.Sitemap = bookRows
    .filter((b) => Boolean(b.slug))
    .map((b) => ({
      url: `${FOXING_BASE_URL}/book/${b.slug}`,
      lastModified: b.updated_at
        ? new Date(b.updated_at)
        : b.created_at
          ? new Date(b.created_at)
          : now,
      changeFrequency: 'monthly',
      priority: 0.8,
    }))

  const authorSlugs = new Set<string>()
  for (const b of bookRows) {
    if (b.author_slug) authorSlugs.add(b.author_slug)
  }
  const authorPages: MetadataRoute.Sitemap = [...authorSlugs].map((slug) => ({
    url: `${FOXING_BASE_URL}/author/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const profilePages: MetadataRoute.Sitemap = (
    (profilesRes.data as Array<{
      username: string
      updated_at: string | null
      created_at: string
    }> | null) ?? []
  )
    .filter((p) => Boolean(p.username))
    .map((p) => ({
      url: `${FOXING_BASE_URL}/u/${encodeURIComponent(p.username)}`,
      lastModified: p.updated_at
        ? new Date(p.updated_at)
        : new Date(p.created_at),
      changeFrequency: 'weekly',
      priority: 0.5,
    }))

  const journalPages: MetadataRoute.Sitemap = (
    (journalRes.data as Array<{
      slug: string
      updated_at: string | null
      published_at: string | null
    }> | null) ?? []
  ).map((p) => ({
    url: `${FOXING_BASE_URL}/journal/${p.slug}`,
    lastModified: p.updated_at
      ? new Date(p.updated_at)
      : p.published_at
        ? new Date(p.published_at)
        : now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const clubPages: MetadataRoute.Sitemap = (
    (clubsRes.data as Array<{
      id: string
      slug: string | null
      updated_at: string | null
      created_at: string
    }> | null) ?? []
  )
    .filter((c) => Boolean(c.slug))
    .map((c) => ({
      url: `${FOXING_BASE_URL}/clubs/${c.slug}`,
      lastModified: c.updated_at
        ? new Date(c.updated_at)
        : new Date(c.created_at),
      changeFrequency: 'weekly',
      priority: 0.5,
    }))

  const listPages: MetadataRoute.Sitemap = (
    (listsRes.data as unknown as Array<{
      id: string
      slug: string | null
      updated_at: string | null
      created_at: string
      profiles: { username: string } | null
    }> | null) ?? []
  )
    .filter((l) => Boolean(l.slug) && Boolean(l.profiles?.username))
    .map((l) => ({
      url: `${FOXING_BASE_URL}/u/${l.profiles!.username}/lists/${l.slug}`,
      lastModified: l.updated_at
        ? new Date(l.updated_at)
        : new Date(l.created_at),
      changeFrequency: 'monthly',
      priority: 0.5,
    }))

  // Celebrity picks: every published club+month pick.
  type CelebrityPickRow = {
    pick_month: number | null
    pick_year: number | null
    external_book_clubs:
      | { slug: string }
      | { slug: string }[]
      | null
  }
  const celebrityPickRows: CelebrityPickRow[] =
    (celebrityPicksRes.data as unknown as CelebrityPickRow[] | null) ?? []

  const celebrityPickPages: MetadataRoute.Sitemap = []
  const roundupKeys = new Set<string>()
  for (const row of celebrityPickRows) {
    if (!row.pick_month || !row.pick_year) continue
    const clubRel = Array.isArray(row.external_book_clubs)
      ? row.external_book_clubs[0]
      : row.external_book_clubs
    if (!clubRel?.slug) continue
    const m = String(row.pick_month).padStart(2, '0')
    celebrityPickPages.push({
      url: `${FOXING_BASE_URL}/book-clubs/${clubRel.slug}/${row.pick_year}/${m}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    })
    roundupKeys.add(`${row.pick_year}-${m}`)
  }

  // Monthly roundup pages: every distinct (year, month) with a published pick.
  const monthlyRoundupPages: MetadataRoute.Sitemap = [...roundupKeys].map(
    (key) => {
      const [yStr, mStr] = key.split('-')
      return {
        url: `${FOXING_BASE_URL}/book-clubs/picks/${yStr}/${mStr}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.9,
      }
    },
  )

  // Celebrity club profile pages: one per external book club.
  const externalClubRows =
    (externalClubsRes.data as Array<{ slug: string | null }> | null) ?? []
  const externalClubPages: MetadataRoute.Sitemap = externalClubRows
    .filter((c) => Boolean(c.slug))
    .map((c) => ({
      url: `${FOXING_BASE_URL}/book-clubs/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

  // Series pages: every distinct series_name, slugified.
  const seriesRows =
    (seriesRes.data as Array<{ series_name: string | null }> | null) ?? []
  const seriesSlugs = new Set<string>()
  for (const row of seriesRows) {
    if (!row.series_name) continue
    const slug = slugifySeriesName(row.series_name)
    if (slug) seriesSlugs.add(slug)
  }
  const seriesPages: MetadataRoute.Sitemap = [...seriesSlugs].map((slug) => ({
    url: `${FOXING_BASE_URL}/series/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  const eventStates = await fetchEventStates()
  const eventStatePages: MetadataRoute.Sitemap = eventStates.map((s) => ({
    url: `${FOXING_BASE_URL}/events/${s.toLowerCase()}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.6,
  }))

  return [
    ...staticPages,
    ...bookPages,
    ...authorPages,
    ...journalPages,
    ...profilePages,
    ...clubPages,
    ...listPages,
    ...monthlyRoundupPages,
    ...celebrityPickPages,
    ...externalClubPages,
    ...seriesPages,
    ...eventStatePages,
  ]
}
