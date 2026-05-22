'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import {
  PLUS_ANNUAL_SAVINGS_LABEL,
  PLUS_PRICE_ANNUAL,
  PLUS_PRICE_MONTHLY,
} from '@/lib/config'

type Period = 'monthly' | 'yearly'

export function PricingContent() {
  const [period, setPeriod] = useState<Period>('monthly')
  return (
    <>
      <PeriodToggle period={period} onChange={setPeriod} />
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
          price={period === 'yearly' ? PLUS_PRICE_ANNUAL : PLUS_PRICE_MONTHLY}
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
    </>
  )
}

function PeriodToggle({
  period,
  onChange,
}: {
  period: Period
  onChange: (next: Period) => void
}) {
  return (
    <div className="mt-8 flex justify-center">
      <div
        role="tablist"
        aria-label="Billing period"
        className="relative inline-flex overflow-hidden rounded-full border border-border-subtle bg-bg-sunken p-0.5"
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-y-0.5 rounded-full bg-brand-subtle transition-all duration-200 ease-out',
            period === 'monthly' ? 'left-0.5 right-1/2' : 'left-1/2 right-0.5',
          )}
        />
        <button
          type="button"
          role="tab"
          aria-selected={period === 'monthly'}
          onClick={() => onChange('monthly')}
          className={cn(
            'relative z-10 px-4 py-1.5 font-dm-sans text-sm transition-colors duration-150',
            period === 'monthly' ? 'text-brand-subtle-text' : 'text-text-tertiary hover:text-text-primary',
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={period === 'yearly'}
          onClick={() => onChange('yearly')}
          className={cn(
            'relative z-10 px-4 py-1.5 font-dm-sans text-sm transition-colors duration-150',
            period === 'yearly' ? 'text-brand-subtle-text' : 'text-text-tertiary hover:text-text-primary',
          )}
        >
          Yearly ({PLUS_ANNUAL_SAVINGS_LABEL})
        </button>
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
