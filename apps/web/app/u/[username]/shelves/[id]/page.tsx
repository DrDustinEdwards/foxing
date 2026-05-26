import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchProfileByUsername } from '@/lib/queries'
import { fetchPublicShelf } from '@/lib/shelves'

export const revalidate = 300

export async function generateMetadata(
  props: {
    params: Promise<{ username: string; id: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const shelf = await fetchPublicShelf(params.id)
  if (!shelf) return { title: 'Shelf not found' }
  return {
    title: `${shelf.name} · @${params.username} · Foxing`,
    description:
      shelf.description ??
      `A reading shelf by @${params.username} on Foxing.`,
  }
}

export default async function PublicShelfPage(
  props: {
    params: Promise<{ username: string; id: string }>
  }
) {
  const params = await props.params;
  const [profile, shelf] = await Promise.all([
    fetchProfileByUsername(params.username),
    fetchPublicShelf(params.id),
  ])
  if (!profile || !shelf) notFound()
  if (shelf.owner_username !== profile.username) notFound()
  if (!profile.is_public) notFound()

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col gap-3">
            <Link
              href={`/u/${profile.username}`}
              className="font-dm-sans text-sm text-brand-text hover:underline"
            >
              ← {profile.display_name}
            </Link>
            <h1 className="font-fraunces text-[2rem] text-text-primary">
              {shelf.name}
            </h1>
            {shelf.description && (
              <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
                {shelf.description}
              </p>
            )}
            <p className="font-dm-mono text-xs text-text-tertiary">
              {shelf.books.length} {shelf.books.length === 1 ? 'book' : 'books'}
            </p>
          </header>

          <section className="mt-8">
            {shelf.books.length === 0 ? (
              <p className="font-source-serif-4 text-base text-text-tertiary">
                This shelf is empty.
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
      </main>
      <Footer />
    </div>
  )
}
