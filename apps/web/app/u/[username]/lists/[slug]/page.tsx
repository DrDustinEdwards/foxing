import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { LikeListButton } from '@/components/ui/like-list-button'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PrivateProfileNotice } from '@/components/private-profile-notice'
import { ShareButton } from '@/components/share-button'
import { fetchProfileByUsername, isUuid } from '@/lib/queries'
import { fetchPublicReadingList } from '@/lib/missing-pages-queries'
import { buildReadingListMetadata } from '@/lib/metadata'
import { getAuthedUserId } from '@/lib/nav-user'
import { siteOrigin } from '@/lib/foxing'
import { safeJsonLd } from '@/lib/structured-data'

export const revalidate = 300

export async function generateMetadata(
  props: {
    params: Promise<{ username: string; slug: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const profile = await fetchProfileByUsername(params.username)
  if (!profile || !profile.is_public) {
    return { title: 'List not found', robots: { index: false, follow: true } }
  }
  const list = await fetchPublicReadingList({
    userId: profile.id,
    slugOrId: params.slug,
  })
  if (!list) {
    return { title: 'List not found', robots: { index: false, follow: true } }
  }
  return buildReadingListMetadata({
    id: list.id,
    slug: list.slug,
    title: list.title,
    description: list.description,
    username: profile.username,
    display_name: profile.display_name,
  })
}

export default async function UserListDetailPage(
  props: {
    params: Promise<{ username: string; slug: string }>
  }
) {
  const params = await props.params;
  const [profile, viewerId] = await Promise.all([
    fetchProfileByUsername(params.username),
    getAuthedUserId(),
  ])
  if (!profile) notFound()
  if (!profile.is_public) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-base">
        <NavAuthClient />
        <main className="flex-1">
          <PrivateProfileNotice username={profile.username} />
        </main>
        <Footer />
      </div>
    )
  }
  const list = await fetchPublicReadingList({
    userId: profile.id,
    slugOrId: params.slug,
    viewerId,
  })
  if (!list) notFound()
  if (isUuid(params.slug) && list.slug && list.slug !== params.slug) {
    permanentRedirect(`/u/${profile.username}/lists/${list.slug}`)
  }

  const origin = siteOrigin()
  const url = `${origin}/u/${profile.username}/lists/${list.slug ?? list.id}`
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: list.title,
    description: list.description ?? undefined,
    url,
    numberOfItems: 0,
    itemListElement: [] as unknown[],
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }}
      />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <Link
            href={`/u/${profile.username}/lists`}
            className="font-dm-sans text-sm text-text-tertiary hover:text-text-primary"
          >
            ← @{profile.username}&apos;s lists
          </Link>
          <header className="mt-6 flex flex-col gap-3">
            <h1 className="font-fraunces text-[2.25rem] text-text-primary">
              {list.title}
            </h1>
            {list.description && (
              <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
                {list.description}
              </p>
            )}
            <p className="font-dm-mono text-[11px] text-text-tertiary">
              A list by @{profile.username}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <LikeListButton
                listId={list.id}
                initialLiked={list.liked_by_me}
                initialCount={list.like_count}
                userId={viewerId}
              />
              <ShareButton url={url} text={list.title} />
            </div>
          </header>

          <div className="mt-10 rounded-lg border border-dashed border-border-default bg-bg-surface p-6 text-center">
            <p className="font-source-serif-4 text-sm italic text-text-tertiary">
              The books in this list will appear here once the
              reading_list_books table is live.
            </p>
          </div>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
