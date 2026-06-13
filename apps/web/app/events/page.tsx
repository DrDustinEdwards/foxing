import Link from 'next/link'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchEventStates, fetchUpcomingEvents } from '@/lib/events'
import { FOXING_BASE_URL, FOXING_SITE_NAME } from '@/lib/metadata'
import { safeJsonLd } from '@/lib/structured-data'
import { EventCard } from './event-card'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Literary events, book signings, and author readings',
  description:
    'Find book signings, author events, and reading club gatherings near you. Updated as events are announced.',
  alternates: { canonical: `${FOXING_BASE_URL}/events` },
  openGraph: {
    type: 'website',
    title: 'Literary events on Foxing',
    description:
      'Book signings, author readings, and book club meetings from verified bookstores.',
    url: `${FOXING_BASE_URL}/events`,
    siteName: FOXING_SITE_NAME,
  },
}

export default async function EventsPage() {
  const [events, states] = await Promise.all([
    fetchUpcomingEvents(),
    fetchEventStates(),
  ])

  const itemListJsonLd = safeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.slice(0, 50).map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Event',
        name: e.title,
        startDate: e.event_date,
        endDate: e.event_end_date ?? undefined,
        location: e.event_location
          ? {
              '@type': 'Place',
              name: e.event_location,
              address: [
                e.event_address,
                e.event_city,
                e.event_state,
                e.event_zip,
              ]
                .filter(Boolean)
                .join(', '),
            }
          : undefined,
        organizer: e.club
          ? { '@type': 'Organization', name: e.club.name }
          : undefined,
      },
    })),
  })

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: itemListJsonLd }}
      />
      <main className="flex-1">
        <PageWrapper className="py-12">
          <header className="max-w-prose">
            <h1 className="font-fraunces text-[2.5rem] leading-tight text-text-primary">
              Literary Events
            </h1>
            <p className="mt-3 font-source-serif-4 text-base text-text-secondary">
              Author signings, book clubs, and readings near you.
            </p>
          </header>

          {states.length > 0 && (
            <nav className="mt-8 flex flex-wrap gap-2 font-dm-sans text-sm">
              <span className="text-text-tertiary">By state:</span>
              {states.map((s) => (
                <Link
                  key={s}
                  href={`/events/${s.toLowerCase()}`}
                  className="text-brand-text hover:underline"
                >
                  {s}
                </Link>
              ))}
            </nav>
          )}

          {events.length === 0 ? (
            <p className="mt-12 font-source-serif-4 text-base text-text-tertiary">
              No upcoming events yet. Check back soon.
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
