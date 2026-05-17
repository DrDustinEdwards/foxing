import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchProfileBasics } from '@/lib/user-queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { FindNextBookWizard } from './wizard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Find your next book · Foxing',
}

export default async function FindNextBookPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const profile = await fetchProfileBasics(userId)
  const tier = profile?.subscription_tier
  const isUnlocked = tier === 'plus' || tier === 'patron'

  return (
    <PageWrapper className="max-w-prose py-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Find your next book
      </h1>
      <p className="mt-3 font-source-serif-4 text-base text-text-secondary">
        Pick a mood, pace, and era. The AI returns three picks with a line
        about why each one fits.
      </p>

      {isUnlocked ? (
        <FindNextBookWizard />
      ) : (
        <UpgradeCard />
      )}
    </PageWrapper>
  )
}

function UpgradeCard() {
  return (
    <div className="mt-8 flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-6">
      <div className="relative overflow-hidden rounded-lg bg-bg-sunken p-4">
        <p className="select-none font-source-serif-4 text-base text-text-secondary blur-[2px]">
          Three books picked for you, with one specific line each on why this
          mood, this pace, this era. No filler.
        </p>
      </div>
      <div>
        <h2 className="font-fraunces text-xl text-text-primary">
          A Foxing Plus feature
        </h2>
        <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
          Plus also covers Deep Dive analysis and unlimited AI lookups.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/pricing">
          <Button variant="primary" size="md">
            Upgrade to Plus
          </Button>
        </Link>
        <Link href="/books">
          <Button variant="secondary" size="md">
            Browse the catalog
          </Button>
        </Link>
      </div>
    </div>
  )
}
