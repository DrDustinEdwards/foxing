import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'

export type Platform = 'app' | 'web' | 'both'

interface SectionProps {
  id: string
  eyebrow: string
  heading: string
  tier?: 'free' | 'plus'
  platform?: Platform
  children: ReactNode
}

export function Section({
  id,
  eyebrow,
  heading,
  tier,
  platform,
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      className="mt-16 border-t border-border-subtle pt-12 first-of-type:mt-0 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <p className="mb-2 font-dm-mono text-[0.6875rem] uppercase tracking-[0.14em] text-text-tertiary">
        {eyebrow}
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-fraunces text-[1.625rem] text-text-primary">
          {heading}
        </h2>
        {tier ? <TierBadge tier={tier} /> : null}
        {platform ? <PlatformBadge platform={platform} /> : null}
      </div>
      {children}
    </section>
  )
}

interface SubgroupProps {
  title?: string
  tier?: 'free' | 'plus'
  platform?: Platform
  meta?: string
  children: ReactNode
}

export function Subgroup({
  title,
  tier,
  platform,
  meta,
  children,
}: SubgroupProps) {
  if (!title && !tier && !meta && !platform) {
    return <div className="mt-4">{children}</div>
  }
  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {title ? (
          <h3 className="font-fraunces text-[1.125rem] text-text-primary">
            {title}
          </h3>
        ) : null}
        {tier ? <TierBadge tier={tier} /> : null}
        {platform ? <PlatformBadge platform={platform} /> : null}
        {meta ? (
          <span className="font-dm-sans text-xs text-text-tertiary">
            {meta}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

export function TierBadge({ tier }: { tier: 'free' | 'plus' }) {
  if (tier === 'free') return <Badge variant="neutral">Free</Badge>
  return <Badge variant="brand">Plus</Badge>
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  if (platform === 'both') return null
  return (
    <span className="inline-flex items-center rounded-full border border-border-default px-2 py-0.5 font-dm-mono text-[0.625rem] uppercase tracking-[0.08em] text-text-tertiary">
      {platform === 'app' ? 'App only' : 'Web only'}
    </span>
  )
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <p className="font-source-serif-4 text-base text-text-secondary leading-[1.85]">
      {children}
    </p>
  )
}

export function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="font-dm-sans text-[0.9375rem] text-text-secondary"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}
