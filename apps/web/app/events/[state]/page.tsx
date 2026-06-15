import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import {
  fetchEventCitiesForState,
  fetchEventStates,
  fetchUpcomingEvents,
} from '@/lib/events'
import { FOXING_BASE_URL, FOXING_SITE_NAME } from '@/lib/metadata'
import { EventCard } from '../event-card'

export const revalidate = 3600

export async function generateStaticParams() {
  const states = await fetchEventStates()
  return states.map((s) => ({ state: s.toLowerCase() }))
}

function stateCode(raw: string): string {
  return raw.toUpperCase().slice(0, 2)
}

export async function generateMetadata(
  props: {
    params: Promise<{ state: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const code = stateCode(params.state)
  return {
    title: `Literary events in ${code}, book signings and readings`,
    description: `Author events, book signings, and reading club meetings in ${code}.`,
    alternates: {
      canonical: `${FOXING_BASE_URL}/events/${params.state.toLowerCase()}`,
    },
    openGraph: {
      type: 'website',
      title: `Literary events in ${code}`,
      description: `Author events and book club meetings in ${code}.`,
      url: `${FOXING_BASE_URL}/events/${params.state.toLowerCase()}`,
      siteName: FOXING_SITE_NAME,
    },
  }
}

export default async function StateEventsPage(
  props: {
    params: Promise<{ state: string }>
  }
) {
  const params = await props.params;
  const code = stateCode(params.state)
  if (!/^[A-Z]{2}$/.test(code)) notFound()

  const [events, cities] = await Promise.all([
    fetchUpcomingEvents({ state: code }),
    fetchEventCitiesForState(code),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
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
          <div className="mt-4">
            <PageHeader
              title={`Literary events in ${code}`}
              subtitle="Upcoming author signings, readings, and book club meetings."
              subtitleVariant="description"
            />
          </div>

          {cities.length > 0 && (
            <nav className="mt-6 flex flex-wrap gap-2 font-dm-sans text-sm">
              <span className="text-text-tertiary">By city:</span>
              {cities.map((c) => (
                <Link
                  key={c}
                  href={`/events/${params.state.toLowerCase()}/${c.toLowerCase()}`}
                  className="text-brand-text hover:underline"
                >
                  {c}
                </Link>
              ))}
            </nav>
          )}

          {events.length === 0 ? (
            <p className="mt-12 font-source-serif-4 text-base text-text-tertiary">
              No upcoming events in {code} yet.
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
