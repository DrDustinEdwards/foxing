import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 86_400
export const dynamic = 'force-static'

type PickRow = {
  pick_month: number | null
  pick_year: number | null
  external_book_clubs:
    | { slug: string | null }
    | { slug: string | null }[]
    | null
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return []
  }

  const now = new Date()
  const supabase = createAdminClient()

  const clubProfiles: MetadataRoute.Sitemap = []
  try {
    const { data } = await supabase
      .from('external_book_clubs')
      .select('slug')
    const rows = (data as Array<{ slug: string | null }> | null) ?? []
    for (const r of rows) {
      if (!r.slug) continue
      clubProfiles.push({
        url: `${FOXING_BASE_URL}/book-clubs/${r.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    }
  } catch {
    // partial sitemap is better than 500
  }

  const pickPages: MetadataRoute.Sitemap = []
  const roundupKeys = new Set<string>()
  try {
    const { data } = await supabase
      .from('external_book_club_picks')
      .select('pick_month, pick_year, external_book_clubs:club_id(slug)')
      .eq('is_published', true)
    const rows = (data as unknown as PickRow[] | null) ?? []
    for (const row of rows) {
      if (!row.pick_month || !row.pick_year) continue
      const clubRel = Array.isArray(row.external_book_clubs)
        ? row.external_book_clubs[0]
        : row.external_book_clubs
      if (!clubRel?.slug) continue
      const m = String(row.pick_month).padStart(2, '0')
      pickPages.push({
        url: `${FOXING_BASE_URL}/book-clubs/${clubRel.slug}/${row.pick_year}/${m}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.8,
      })
      roundupKeys.add(`${row.pick_year}-${m}`)
    }
  } catch {
    // partial sitemap is better than 500
  }

  const roundupPages: MetadataRoute.Sitemap = [...roundupKeys].map((key) => {
    const [yStr, mStr] = key.split('-')
    return {
      url: `${FOXING_BASE_URL}/book-clubs/picks/${yStr}/${mStr}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    }
  })

  return [...clubProfiles, ...pickPages, ...roundupPages]
}
