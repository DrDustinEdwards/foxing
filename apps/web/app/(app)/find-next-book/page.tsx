import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import {
  PLUS_PRICE_MONTHLY_LABEL,
  PLUS_TRIAL_LABEL,
} from '@/lib/config'
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
  const isUnlocked = tier === 'plus'

  return (
    <PageWrapper className="max-w-prose py-10">
      <PageHeader
        title="Find your next book"
        subtitle="Pick a mood, pace, and era. The AI returns three picks with a line about why each one fits."
        subtitleVariant="description"
      />

      {isUnlocked ? (
        <FindNextBookWizard />
      ) : (
        <PaywallPreview />
      )}
    </PageWrapper>
  )
}

function PaywallPreview() {
  return (
    <div className="relative mt-8">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none blur-[3px]"
      >
        <FindNextBookWizard />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-4"
            >
              <div className="h-40 rounded bg-bg-sunken" />
              <div className="h-3 w-3/4 rounded bg-bg-sunken" />
              <div className="h-3 w-1/2 rounded bg-bg-sunken" />
              <div className="mt-2 h-12 rounded bg-bg-sunken" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-bg-base/80 to-bg-base">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-border-default bg-bg-elevated p-6 text-center shadow-lg">
          <h2 className="font-fraunces text-xl text-text-primary">
            Unlock with Foxing Plus
          </h2>
          <p className="font-source-serif-4 text-sm text-text-secondary">
            Three books picked for the mood and pace you want, with a real
            reason for each. Plus also covers Deep Dive analysis and
            unlimited AI lookups.
          </p>
          <p className="font-dm-mono text-xs uppercase tracking-wide text-text-tertiary">
            {PLUS_PRICE_MONTHLY_LABEL} · {PLUS_TRIAL_LABEL}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/pricing">
              <Button variant="primary" size="md">
                Upgrade to Plus
              </Button>
            </Link>
            <Link href="/books">
              <Button variant="ghost" size="md">
                Browse the catalog
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
