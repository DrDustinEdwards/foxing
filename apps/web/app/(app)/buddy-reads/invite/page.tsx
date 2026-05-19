import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'
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
  if (tier !== 'plus' && tier !== 'patron') {
    redirect('/pricing')
  }
  return (
    <PageWrapper className="max-w-prose py-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Start a buddy read
      </h1>
      <p className="mt-2 font-source-serif-4 text-base text-text-secondary">
        Pick a book and a reading partner. You will be able to share
        chapter-by-chapter thoughts.
      </p>
      <InviteForm />
    </PageWrapper>
  )
}
