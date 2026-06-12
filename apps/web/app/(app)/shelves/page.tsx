import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { getAuthedUserId } from '@/lib/nav-user'
import { fetchUserShelves } from '@/lib/shelves'
import { ShelfCreateForm } from './shelf-create-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My shelves · Foxing',
  robots: { index: false, follow: false },
}

export default async function ShelvesPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in?next=/shelves')
  const shelves = await fetchUserShelves(userId)

  return (
    <PageWrapper className="py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-fraunces text-[2rem] text-text-primary">
          My shelves
        </h1>
        <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
          Custom shelves let you group books however you like. Make them
          public to share on your profile.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="mb-3 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
          Create a shelf
        </h2>
        <ShelfCreateForm />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
          Your shelves
        </h2>
        {shelves.length === 0 ? (
          <p className="font-source-serif-4 text-base text-text-tertiary">
            You have not created any shelves yet.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {shelves.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <Link
                      href={`/shelves/${s.id}`}
                      className="font-fraunces text-lg text-text-primary hover:text-brand-text"
                    >
                      {s.name}
                    </Link>
                    <span className="font-dm-mono text-xs text-text-tertiary">
                      {s.book_count} {s.book_count === 1 ? 'book' : 'books'}
                    </span>
                  </div>
                  {s.is_public && <Badge variant="info">Public</Badge>}
                </div>
                {s.description && (
                  <p className="font-source-serif-4 text-sm text-text-secondary">
                    {s.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageWrapper>
  )
}
