import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { getAuthedUserId } from '@/lib/nav-user'
import { fetchShelfForOwner } from '@/lib/shelves'
import { ShelfEditPanel } from './shelf-edit-panel'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Shelf · Foxing',
  robots: { index: false, follow: false },
}

export default async function ShelfDetailPage(
  props: {
    params: Promise<{ id: string }>
  }
) {
  const params = await props.params;
  const userId = await getAuthedUserId()
  if (!userId) redirect(`/sign-in?next=/shelves/${params.id}`)
  const shelf = await fetchShelfForOwner(userId, params.id)
  if (!shelf) notFound()

  return (
    <PageWrapper className="py-10">
      <header className="flex flex-col gap-3">
        <Link
          href="/shelves"
          className="font-dm-sans text-sm text-brand-text hover:underline"
        >
          ← All shelves
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-fraunces text-[2rem] text-text-primary">
              {shelf.name}
            </h1>
            {shelf.description && (
              <p className="mt-2 max-w-prose font-source-serif-4 text-base text-text-secondary">
                {shelf.description}
              </p>
            )}
          </div>
          {shelf.is_public && <Badge variant="info">Public</Badge>}
        </div>
      </header>

      <ShelfEditPanel
        shelf={{
          id: shelf.id,
          name: shelf.name,
          description: shelf.description,
          is_public: shelf.is_public,
        }}
      />

      <section className="mt-10">
        <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Books on this shelf ({shelf.books.length})
        </h2>
        {shelf.books.length === 0 ? (
          <p className="font-source-serif-4 text-base text-text-tertiary">
            Add books to this shelf from any book page.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {shelf.books.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/book/${b.slug ?? b.id}`}
                  className="group flex flex-col gap-2"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-bg-sunken shadow-sm">
                    {b.cover_url && (
                      <Image
                        src={b.cover_url}
                        alt={b.title}
                        fill
                        sizes="(max-width: 768px) 45vw, 18vw"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <p className="truncate font-fraunces text-sm text-text-primary group-hover:text-brand-text">
                    {b.title}
                  </p>
                  <p className="truncate font-dm-sans text-xs text-text-tertiary">
                    {b.author}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageWrapper>
  )
}
