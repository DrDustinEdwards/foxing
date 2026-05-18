import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { ShareButton } from '@/components/share-button'
import { fetchPassageOfDay } from '@/lib/missing-pages-queries'
import { buildPassageMetadata } from '@/lib/metadata'
import { getNavUser } from '@/lib/nav-user'
import { appBookDeeplink, siteOrigin } from '@/lib/foxing'

export const revalidate = 86400

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function generateMetadata({
  params,
}: {
  params: { date: string }
}): Promise<Metadata> {
  if (!ISO_DATE.test(params.date)) {
    return { title: 'Passage not found', robots: { index: false, follow: true } }
  }
  const passage = await fetchPassageOfDay(params.date)
  if (!passage) {
    return { title: 'Passage not found', robots: { index: false, follow: true } }
  }
  return buildPassageMetadata({
    date: params.date,
    excerpt: passage.text,
    bookTitle: passage.book.title,
    bookAuthor: passage.book.author,
    username: passage.author?.username ?? null,
  })
}

export default async function PassagePage({
  params,
}: {
  params: { date: string }
}) {
  if (!ISO_DATE.test(params.date)) notFound()
  const [navUser, passage] = await Promise.all([
    getNavUser(),
    fetchPassageOfDay(params.date),
  ])
  if (!passage) notFound()

  const origin = siteOrigin()
  const url = `${origin}/passage/${params.date}`
  const formatted = new Date(`${params.date}T00:00:00Z`).toLocaleDateString(
    'en-US',
    { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' },
  )

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-16">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
            <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
              Passage of the day · {formatted}
            </p>
            <blockquote className="font-source-serif-4 text-[1.5rem] italic leading-relaxed text-text-primary md:text-[1.75rem]">
              &ldquo;{passage.text}&rdquo;
            </blockquote>
            <div className="flex items-center gap-4">
              <Link
                href={`/book/${passage.book.slug ?? passage.book.id}`}
                className="relative h-24 w-16 overflow-hidden rounded bg-bg-sunken shadow-sm"
              >
                {passage.book.cover_url && (
                  <Image
                    src={passage.book.cover_url}
                    alt={passage.book.title}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                )}
              </Link>
              <div className="flex flex-col items-start">
                <Link
                  href={`/book/${passage.book.slug ?? passage.book.id}`}
                  className="font-fraunces text-base text-text-primary hover:text-brand-text"
                >
                  {passage.book.title}
                </Link>
                <span className="font-dm-sans text-sm text-text-tertiary">
                  {passage.book.author}
                </span>
                {passage.author && (
                  <Link
                    href={`/u/${passage.author.username}`}
                    className="mt-1 font-dm-sans text-xs text-text-tertiary hover:text-text-primary"
                  >
                    Saved by @{passage.author.username}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a href={appBookDeeplink(passage.book.id)}>
                <Button variant="primary" size="md">
                  Read {passage.book.title} free
                </Button>
              </a>
              <ShareButton url={url} text={passage.text} />
            </div>
          </div>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
