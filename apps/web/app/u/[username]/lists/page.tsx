import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PrivateProfileNotice } from '@/components/private-profile-notice'
import { Card } from '@/components/ui/card'
import { UserSubpageHeader } from '@/components/user-subpage-header'
import { fetchProfileByUsername } from '@/lib/queries'
import {
  fetchPublicReadingLists,
  fetchUserCounts,
} from '@/lib/missing-pages-queries'
import { buildUserListsMetadata } from '@/lib/metadata'

export const revalidate = 300

export async function generateMetadata(
  props: {
    params: Promise<{ username: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const profile = await fetchProfileByUsername(params.username)
  if (!profile || !profile.is_public) {
    return { title: 'Profile not found', robots: { index: false, follow: true } }
  }
  const counts = await fetchUserCounts(profile.id)
  return buildUserListsMetadata({
    display_name: profile.display_name,
    username: profile.username,
    list_count: counts.list_count,
  })
}

export default async function UserListsPage(
  props: {
    params: Promise<{ username: string }>
  }
) {
  const params = await props.params;
  const [profile] = await Promise.all([
    fetchProfileByUsername(params.username),
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
  const lists = await fetchPublicReadingLists(profile.id)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <UserSubpageHeader
            username={profile.username}
            displayName={profile.display_name}
            section="lists"
          />

          {lists.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              No public lists yet.
            </p>
          ) : (
            <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {lists.map((l) => (
                <li key={l.id}>
                  <Card
                    variant="entity"
                    href={`/u/${profile.username}/lists/${l.slug ?? l.id}`}
                    className="gap-2 p-4"
                  >
                    <h2 className="font-fraunces text-base text-text-primary">
                      {l.title}
                    </h2>
                    {l.description && (
                      <p className="line-clamp-3 font-source-serif-4 text-sm text-text-secondary">
                        {l.description}
                      </p>
                    )}
                    <p className="mt-auto font-dm-mono text-[11px] text-text-tertiary">
                      {l.is_featured ? 'Featured · ' : ''}
                      {new Date(l.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </Card>
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
