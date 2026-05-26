import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { BookCard } from '@/components/book-card'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchBooksForTheme,
} from '@/lib/missing-pages-queries'
import {
  THEME_DEFINITIONS,
  buildThemeMetadata,
} from '@/lib/metadata'

export const dynamic = 'force-static'

export const revalidate = 86400

export function generateStaticParams() {
  return Object.keys(THEME_DEFINITIONS).map((theme) => ({ theme }))
}

export async function generateMetadata(
  props: {
    params: Promise<{ theme: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  return buildThemeMetadata(params.theme)
}

export default async function ThemePage(
  props: {
    params: Promise<{ theme: string }>
  }
) {
  const params = await props.params;
  const theme = THEME_DEFINITIONS[params.theme]
  if (!theme) notFound()
  const books = await fetchBooksForTheme({
    searchTerms: theme.searchTerms,
    limit: 24,
  })

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col gap-2">
            <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
              Theme
            </p>
            <h1 className="font-fraunces text-[2.25rem] text-text-primary">
              {theme.name}
            </h1>
            <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
              {theme.description}
            </p>
          </header>

          {books.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              No matches in the catalog yet,{' '}
              <Link href="/books" className="text-brand-text hover:underline">
                browse all books
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {books.map((b) => (
                <li key={b.id} className="flex justify-center">
                  <BookCard
                    book={{
                      id: b.id,
                      title: b.title,
                      author: b.author,
                      cover_url: b.cover_url,
                      themes: b.themes,
                    }}
                    showRating={false}
                  />
                </li>
              ))}
            </ul>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
