import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { getAuthedUserId } from '@/lib/nav-user'
import { fetchSimilarReaders } from '@/lib/similar-readers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Similar readers · Foxing',
  description: 'Discover readers with matching taste based on books in common.',
  robots: { index: false, follow: false },
}

export default async function SimilarReadersPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in?next=/people/similar')
  const [readers] = await Promise.all([
    fetchSimilarReaders(userId),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <PageHeader
            title="Readers with similar taste"
            subtitle="Ranked by books you have both finished."
            subtitleVariant="description"
          />

          {readers.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              Finish a few more books to see similar readers.
            </p>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {readers.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
                >
                  <Link
                    href={`/u/${r.username}`}
                    className="flex items-center gap-3"
                  >
                    <Avatar
                      src={r.avatar_url}
                      name={r.display_name}
                      size="md"
                    />
                    <div className="flex min-w-0 flex-col">
                      <p className="truncate font-fraunces text-base text-text-primary hover:text-brand-text">
                        {r.display_name}
                      </p>
                      <p className="truncate font-dm-sans text-xs text-text-tertiary">
                        @{r.username}
                      </p>
                    </div>
                  </Link>
                  {r.reading_personality && (
                    <p className="font-source-serif-4 text-sm italic text-text-tertiary">
                      {r.reading_personality}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant="brand">
                      {r.shared_count}{' '}
                      {r.shared_count === 1 ? 'book' : 'books'} in common
                    </Badge>
                    <Link
                      href={`/u/${r.username}/compare`}
                      className="font-dm-sans text-xs text-brand-text hover:underline"
                    >
                      Compare →
                    </Link>
                  </div>
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
