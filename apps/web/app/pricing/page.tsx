import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { getNavUser } from '@/lib/nav-user'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'
import { cn } from '@/lib/cn'

export const revalidate = 3600

export const metadata = STATIC_PAGE_METADATA['/pricing']

interface PricingPageProps {
  searchParams: { period?: 'monthly' | 'yearly' }
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const navUser = await getNavUser()
  const period: 'monthly' | 'yearly' =
    searchParams.period === 'yearly' ? 'yearly' : 'monthly'
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
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
              7-day free trial. No credit card required. Cancel anytime.
            </p>
          </header>

          <PeriodToggle period={period} />

          <section className="mx-auto mt-8 grid max-w-3xl gap-5 md:grid-cols-2">
            <PricingCard
              name="Free"
              price="$0"
              cadence="forever"
              cta="Join free"
              ctaHref="/sign-up"
              variant="ghost"
              features={[
                '1,400+ classic books, free',
                'Reader, highlights, vocabulary',
                'Reading diary, stats, lists',
                'Five AI word lookups a day',
                'Join one book club',
              ]}
            />
            <PricingCard
              highlight
              name="Plus"
              price={period === 'yearly' ? '$129.99' : '$12.99'}
              cadence={period === 'yearly' ? 'per year' : 'per month'}
              cta="Start with Plus"
              ctaHref="/sign-up?plan=plus"
              variant="primary"
              features={[
                'Everything in Free',
                'Unlimited AI word lookups, passage analysis, and Deep Dive',
                'Create unlimited book clubs and passage comments',
                'Buddy reads, quote cards, Year in Reading',
                'Reading personality that updates continuously',
              ]}
            />
          </section>

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

function PeriodToggle({ period }: { period: 'monthly' | 'yearly' }) {
  return (
    <div className="mt-8 flex justify-center">
      <div className="inline-flex overflow-hidden rounded-full border border-border-subtle">
        <Link
          href="/pricing?period=monthly"
          className={cn(
            'px-4 py-1.5 font-dm-sans text-sm',
            period === 'monthly'
              ? 'bg-brand-subtle text-brand-subtle-text'
              : 'text-text-tertiary hover:text-text-primary',
          )}
        >
          Monthly
        </Link>
        <Link
          href="/pricing?period=yearly"
          className={cn(
            'px-4 py-1.5 font-dm-sans text-sm',
            period === 'yearly'
              ? 'bg-brand-subtle text-brand-subtle-text'
              : 'text-text-tertiary hover:text-text-primary',
          )}
        >
          Yearly (Save $26)
        </Link>
      </div>
    </div>
  )
}

interface PricingCardProps {
  name: string
  price: string
  cadence: string
  cta: string
  ctaHref: string
  features: string[]
  variant: 'primary' | 'ghost'
  highlight?: boolean
}

function PricingCard({
  name,
  price,
  cadence,
  cta,
  ctaHref,
  features,
  variant,
  highlight,
}: PricingCardProps) {
  return (
    <article
      className={cn(
        'flex flex-col gap-5 rounded-xl border bg-bg-surface p-6',
        highlight
          ? 'border-brand-ui shadow-md'
          : 'border-border-subtle shadow-sm',
      )}
    >
      <header>
        <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          {name}
        </p>
        <p className="mt-2 font-fraunces text-[2rem] leading-none text-text-primary">
          {price}
        </p>
        <p className="mt-1 font-dm-sans text-xs text-text-tertiary">
          {cadence}
        </p>
      </header>
      <ul className="flex flex-col gap-2">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 font-source-serif-4 text-sm text-text-secondary"
          >
            <span aria-hidden="true" className="mt-1 text-brand-ui">
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link href={ctaHref}>
        <Button variant={variant} size="md" fullWidth>
          {cta}
        </Button>
      </Link>
    </article>
  )
}
