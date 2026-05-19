import Link from 'next/link'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { getNavUser } from '@/lib/nav-user'

export const revalidate = 86_400

export const metadata: Metadata = {
  title: 'Create a club',
  description:
    'Club creation happens in the Foxing app. Browse public clubs on the web.',
  robots: { index: false, follow: true },
}

export default async function NewClubPage() {
  const navUser = await getNavUser()
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="max-w-prose py-20 text-center">
          <h1 className="font-fraunces text-[2rem] text-text-primary">
            Create clubs in the Foxing app
          </h1>
          <p className="mt-4 font-source-serif-4 text-base text-text-secondary leading-[1.7]">
            Club creation is mobile-only for now. Download the Foxing app to
            create a club, invite members, and run chapter-by-chapter
            discussions.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4 font-dm-sans text-sm">
            <Link
              href="/clubs"
              className="text-brand-text hover:underline"
            >
              Browse public clubs
            </Link>
            <Link
              href="/app-guide#clubs"
              className="text-brand-text hover:underline"
            >
              How clubs work in the app
            </Link>
          </div>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
