import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { getAuthedUserId } from '@/lib/nav-user'
import { CreateClubForm } from './create-club-form'

export const metadata: Metadata = {
  title: 'Create a club',
  description: 'Start a reading community or a book club on Foxing.',
  robots: { index: false, follow: true },
}

export default async function NewClubPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="max-w-prose py-12">
          <header className="mb-8">
            <h1 className="font-fraunces text-[2rem] text-text-primary">
              Start a club
            </h1>
            <p className="mt-3 font-source-serif-4 text-base text-text-secondary leading-[1.7]">
              Run a standing reading community or gather readers around a
              single book. You can set or change the book any time.
            </p>
          </header>
          <CreateClubForm />
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
