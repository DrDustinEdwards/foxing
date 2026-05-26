import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchSeriesBySlug,
} from '@/lib/missing-pages-queries'
import {
  buildSeriesMetadata,
  slugifySeriesName,
} from '@/lib/metadata'
import { appBookDeeplink, siteOrigin } from '@/lib/foxing'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 86400

// Build-time only. Uses the admin client because the server client calls
// next/headers cookies(), which fails outside a request scope. Books are
// public catalog data, so service-role reads here are safe.
export async function generateStaticParams() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return []
  }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('books')
    .select('series_name')
    .not('series_name', 'is', null)
    .neq('series_name', '')
    .limit(5000)
  const seen = new Set<string>()
  const slugs: string[] = []
  for (const row of (data as { series_name: string | null }[] | null) ?? []) {
    if (!row.series_name) continue
    const slug = slugifySeriesName(row.series_name)
    if (seen.has(slug)) continue
    seen.add(slug)
    slugs.push(slug)
    if (slugs.length >= 50) break
  }
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const series = await fetchSeriesBySlug(params.slug)
  if (!series) {
    return { title: 'Series not found', robots: { index: false, follow: true } }
  }
  return buildSeriesMetadata({
    slug: slugifySeriesName(series.name),
    seriesName: series.name,
    bookCount: series.books.length,
    firstBook: series.books[0]?.title,
    lastBook: series.books[series.books.length - 1]?.title,
  })
}

export default async function SeriesDetailPage(
  props: {
    params: Promise<{ slug: string }>
  }
) {
  const params = await props.params;
  const [series] = await Promise.all([
    fetchSeriesBySlug(params.slug),
  ])
  if (!series) notFound()

  const origin = siteOrigin()
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${series.name} reading order`,
    url: `${origin}/series/${slugifySeriesName(series.name)}`,
    numberOfItems: series.books.length,
    itemListElement: series.books.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Book',
        name: b.title,
        author: { '@type': 'Person', name: b.author },
        url: `${origin}/book/${b.slug ?? b.id}`,
        image: b.cover_url ?? undefined,
      },
    })),
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col gap-2">
            <h1 className="font-fraunces text-[2.25rem] text-text-primary">
              {series.name}
            </h1>
            <p className="font-dm-sans text-sm text-text-tertiary">
              {series.books.length} books in reading order
            </p>
          </header>

          <ol className="mt-8 flex flex-col gap-4">
            {series.books.map((b, i) => (
              <li
                key={b.id}
                className="flex items-start gap-4 rounded-lg border border-border-subtle bg-bg-surface p-4"
              >
                <span className="w-6 shrink-0 pt-1 font-dm-mono text-sm text-text-tertiary">
                  {b.series_order ?? i + 1}
                </span>
                <Link
                  href={`/book/${b.slug ?? b.id}`}
                  className="relative h-28 w-20 shrink-0 overflow-hidden rounded bg-bg-sunken"
                >
                  {b.cover_url && (
                    <Image
                      src={b.cover_url}
                      alt={b.title}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={`/book/${b.slug ?? b.id}`}
                    className="font-fraunces text-lg text-text-primary hover:text-brand-text"
                  >
                    {b.title}
                  </Link>
                  <p className="font-dm-sans text-sm text-text-tertiary">
                    {b.author}
                  </p>
                  {b.word_count && (
                    <p className="font-dm-mono text-xs text-text-tertiary">
                      {Math.round(b.word_count / 250).toLocaleString()} pages
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  <a href={appBookDeeplink(b.id)}>
                    <Button variant="primary" size="sm">
                      Read free
                    </Button>
                  </a>
                </div>
              </li>
            ))}
          </ol>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
