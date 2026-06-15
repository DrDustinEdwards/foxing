import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
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
          <div className="mb-8">
            <PageHeader
              title="Start a club"
              subtitle="Run a standing reading community or gather readers around a single book. You can set or change the book any time."
              subtitleVariant="description"
            />
          </div>
          <CreateClubForm />
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
