import Link from 'next/link'
import { ClubCard } from '@/components/club-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchPublicClubs } from '@/lib/queries'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'
import { StartClubButton } from './start-club-button'

export const revalidate = 60

export const metadata = STATIC_PAGE_METADATA['/clubs']

export default async function ClubsIndexPage() {
  const [clubs] = await Promise.all([
    fetchPublicClubs(24),
  ])
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-fraunces text-[2rem] text-text-primary">
              Reading clubs
            </h1>
            <StartClubButton />
          </div>
          {clubs.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                heading="No public clubs yet."
                action={
                  <Link
                    href="/clubs/new"
                    className="font-dm-sans text-sm text-brand-text hover:underline"
                  >
                    Start a club
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {clubs.map((c) => (
                <ClubCard
                  key={c.id}
                  club={{ id: c.id, name: c.name, cover_url: c.cover_url }}
                  currentBook={
                    c.current_book
                      ? {
                          title: c.current_book.title,
                          cover_url: c.current_book.cover_url,
                        }
                      : null
                  }
                  memberCount={c.member_count}
                />
              ))}
            </div>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
