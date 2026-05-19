import Link from 'next/link'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchUpcomingEvents } from '@/lib/events'
import { FOXING_BASE_URL, FOXING_SITE_NAME } from '@/lib/metadata'
import { getNavUser } from '@/lib/nav-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { EventCard } from '../../event-card'

export const revalidate = 3600

async function fetchAuthorName(slug: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('books')
    .select('author')
    .eq('author_slug', slug)
    .limit(1)
    .maybeSingle()
  return (data as { author: string } | null)?.author ?? null
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const name = (await fetchAuthorName(params.slug)) ?? 'this author'
  return {
    title: `Upcoming events for ${name}`,
    description: `Book signings and readings featuring ${name}.`,
    alternates: {
      canonical: `${FOXING_BASE_URL}/events/author/${params.slug}`,
    },
    openGraph: {
      type: 'website',
      title: `Events for ${name}`,
      description: `Book signings and readings featuring ${name}.`,
      url: `${FOXING_BASE_URL}/events/author/${params.slug}`,
      siteName: FOXING_SITE_NAME,
    },
  }
}

export default async function AuthorEventsPage({
  params,
}: {
  params: { slug: string }
}) {
  const [navUser, name, events] = await Promise.all([
    getNavUser(),
    fetchAuthorName(params.slug),
    fetchUpcomingEvents({ authorSlug: params.slug }),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-12">
          <nav className="font-dm-sans text-sm">
            <Link
              href="/events"
              className="text-brand-text hover:underline"
            >
              ← All events
            </Link>
          </nav>
          <header className="mt-4 max-w-prose">
            <h1 className="font-fraunces text-[2.5rem] leading-tight text-text-primary">
              Events for {name ?? 'this author'}
            </h1>
            <p className="mt-3 font-source-serif-4 text-base text-text-secondary">
              Book signings, readings, and book club meetings tied to their
              titles.
            </p>
          </header>

          {events.length === 0 ? (
            <p className="mt-12 font-source-serif-4 text-base text-text-tertiary">
              No upcoming events for {name ?? 'this author'} yet.
            </p>
          ) : (
            <section className="mt-8 grid gap-5 sm:grid-cols-2">
              {events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </section>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
