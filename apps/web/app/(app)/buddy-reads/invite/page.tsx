import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { fetchProfileBasics } from '@/lib/user-queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { InviteForm } from './invite-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Start a buddy read · Foxing',
  robots: { index: false, follow: false },
}

export default async function InvitePage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const profile = await fetchProfileBasics(userId)
  const tier = profile?.subscription_tier
  if (tier !== 'plus') {
    redirect('/pricing')
  }
  return (
    <PageWrapper className="max-w-prose py-10">
      <PageHeader
        title="Start a buddy read"
        subtitle="Pick a book and a reading partner. You will be able to share chapter-by-chapter thoughts."
        subtitleVariant="description"
      />
      <InviteForm />
    </PageWrapper>
  )
}
