import Link from 'next/link'
import type { Metadata } from 'next'
import { ClubCard } from '@/components/club-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchPublicClubs } from '@/lib/queries'
import { getNavUser } from '@/lib/nav-user'
import { siteOrigin } from '@/lib/foxing'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Reading clubs · Foxing',
  description: 'Active book clubs you can join.',
  alternates: { canonical: `${siteOrigin()}/clubs` },
}

export default async function ClubsIndexPage() {
  const [navUser, clubs] = await Promise.all([
    getNavUser(),
    fetchPublicClubs(24),
  ])
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <h1 className="font-fraunces text-[2rem] text-text-primary">
            Reading clubs
          </h1>
          {clubs.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                heading="No public clubs yet."
                action={
                  <Link
                    href="/books"
                    className="font-dm-sans text-sm text-brand-text hover:underline"
                  >
                    Pick a book to start one
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
