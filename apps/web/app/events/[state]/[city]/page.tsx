import Link from 'next/link'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { fetchUpcomingEvents } from '@/lib/events'
import { FOXING_BASE_URL, FOXING_SITE_NAME } from '@/lib/metadata'
import { EventCard } from '../../event-card'

export const revalidate = 3600

function titleCase(s: string): string {
  return s
    .split(/[\s-]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

export async function generateMetadata(
  props: {
    params: Promise<{ state: string; city: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const state = params.state.toUpperCase().slice(0, 2)
  const city = titleCase(decodeURIComponent(params.city))
  return {
    title: `Literary events in ${city}, ${state}`,
    description: `Author events, book signings, and reading club meetings in ${city}, ${state}.`,
    alternates: {
      canonical: `${FOXING_BASE_URL}/events/${params.state.toLowerCase()}/${params.city.toLowerCase()}`,
    },
    openGraph: {
      type: 'website',
      title: `Literary events in ${city}, ${state}`,
      description: `Author events and book club meetings in ${city}, ${state}.`,
      url: `${FOXING_BASE_URL}/events/${params.state.toLowerCase()}/${params.city.toLowerCase()}`,
      siteName: FOXING_SITE_NAME,
    },
  }
}

export default async function CityEventsPage(
  props: {
    params: Promise<{ state: string; city: string }>
  }
) {
  const params = await props.params;
  const code = params.state.toUpperCase().slice(0, 2)
  const cityName = decodeURIComponent(params.city)
  const [events] = await Promise.all([
    fetchUpcomingEvents({ state: code, city: cityName }),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-12">
          <nav className="font-dm-sans text-sm">
            <Link
              href={`/events/${params.state.toLowerCase()}`}
              className="text-brand-text hover:underline"
            >
              ← Events in {code}
            </Link>
          </nav>
          <div className="mt-4">
            <PageHeader
              title={`Literary events in ${titleCase(cityName)}, ${code}`}
              subtitle="Author signings and reading club meetings."
              subtitleVariant="description"
            />
          </div>

          {events.length === 0 ? (
            <p className="mt-12 font-source-serif-4 text-base text-text-tertiary">
              No upcoming events yet for {titleCase(cityName)}.
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
