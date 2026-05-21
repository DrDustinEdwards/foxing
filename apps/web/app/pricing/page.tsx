import Link from 'next/link'
import { Suspense } from 'react'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { NavWithSession } from '@/components/layout/nav-with-session'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PLUS_TRIAL_LABEL } from '@/lib/config'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'
import { PricingContent } from './pricing-content'

export const experimental_ppr = true

export const metadata = STATIC_PAGE_METADATA['/pricing']

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Suspense fallback={<Nav user={null} />}>
        <NavWithSession />
      </Suspense>
      <main className="flex-1">
        <PageWrapper className="py-12">
          <header className="text-center">
            <h1 className="font-fraunces text-[2.5rem] text-text-primary">
              Pick how you read.
            </h1>
            <p className="mx-auto mt-3 max-w-prose font-source-serif-4 text-base text-text-secondary">
              Free works on its own: 1,400+ classic books, library, diary,
              stats, and a few AI lookups a day. Plus adds the AI that reads
              alongside you, plus book club creation and more.
            </p>
            <p className="mt-4 font-dm-sans text-xs text-text-tertiary">
              {PLUS_TRIAL_LABEL}. No credit card required. Cancel anytime.
            </p>
          </header>

          <PricingContent />

          <p className="mt-8 text-center font-dm-sans text-sm">
            <Link
              href="/features"
              className="text-brand-text hover:underline"
            >
              See the full feature list →
            </Link>
          </p>

          <section className="mx-auto mt-12 max-w-prose">
            <h2 className="font-fraunces text-xl text-text-primary">
              How the AI cost gets paid
            </h2>
            <p className="mt-2 font-source-serif-4 text-base text-text-secondary">
              Every AI call costs real money. Five lookups a day stays free
              because that&apos;s what fits the budget. Plus fees go directly
              to compute, hosting, and one person&apos;s time. No ads, no data
              resale.
            </p>
          </section>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
