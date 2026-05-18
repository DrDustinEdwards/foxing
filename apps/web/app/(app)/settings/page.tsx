import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { createClient } from '@/lib/supabase/server'
import { getAuthedUserId } from '@/lib/nav-user'
import { AccountSection } from './account-section'
import { VisibilitySection } from './visibility-section'
import { AccountActionsSection } from './account-actions-section'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
}

interface SettingsProfile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  is_public: boolean
  progress_is_public: boolean | null
  subscription_tier: string | null
  is_admin: boolean | null
}

export default async function SettingsPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in?next=/settings')

  const sb = createClient()
  const { data } = await sb
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, bio, is_public, progress_is_public, subscription_tier, is_admin',
    )
    .eq('id', userId)
    .maybeSingle()
  const profile = data as SettingsProfile | null
  if (!profile) redirect('/sign-in')

  const tier = profile.subscription_tier ?? 'free'

  return (
    <PageWrapper className="max-w-[640px] py-10">
      <h1 className="font-fraunces text-[1.75rem] text-text-primary">
        Settings
      </h1>

      <Section heading="Account">
        <AccountSection
          initial={{
            display_name: profile.display_name,
            username: profile.username,
            bio: profile.bio ?? '',
          }}
        />
      </Section>

      <Section heading="Reading profile">
        <VisibilitySection
          initial={{
            is_public: profile.is_public,
            progress_is_public: Boolean(profile.progress_is_public),
          }}
        />
      </Section>

      <Section heading="Subscription">
        <SubscriptionPanel tier={tier} />
      </Section>

      <Section heading="Account actions">
        <AccountActionsSection username={profile.username} />
      </Section>

      {profile.is_admin && (
        <Section heading="Admin">
          <p className="font-source-serif-4 text-sm text-text-secondary">
            Access the Foxing admin dashboard.
          </p>
          <Link
            href="/admin"
            className="mt-2 inline-block font-dm-sans text-sm font-medium text-brand-text hover:underline"
          >
            Open admin dashboard
          </Link>
        </Section>
      )}
    </PageWrapper>
  )
}

function Section({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-10 border-t border-border-subtle pt-6">
      <h2 className="mb-4 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        {heading}
      </h2>
      {children}
    </section>
  )
}

function SubscriptionPanel({ tier }: { tier: string }) {
  const label = tier === 'plus' ? 'Plus' : tier === 'patron' ? 'Patron' : 'Free'
  const variant: 'success' | 'brand' | 'neutral' =
    tier === 'patron' ? 'success' : tier === 'plus' ? 'brand' : 'neutral'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="font-dm-sans text-sm text-text-secondary">
          Current plan
        </span>
        <Badge variant={variant}>{label}</Badge>
      </div>
      {tier === 'free' ? (
        <p className="font-dm-sans text-sm text-text-tertiary">
          Plus adds unlimited AI lookups, book clubs, and full stats. 7-day
          free trial, no credit card.
        </p>
      ) : (
        <p className="font-dm-sans text-sm text-text-tertiary">
          Manage billing from the Foxing mobile app. Subscriptions sync
          across web and mobile.
        </p>
      )}
      {tier === 'free' ? (
        <Link
          href="/pricing"
          className="self-start rounded-md bg-brand-ui px-4 py-2 font-dm-sans text-sm font-medium text-text-on-brand hover:bg-brand-hover"
        >
          Upgrade to Plus
        </Link>
      ) : (
        <Link
          href="/pricing"
          className="self-start font-dm-sans text-sm text-brand-text hover:underline"
        >
          Manage subscription
        </Link>
      )}
    </div>
  )
}
