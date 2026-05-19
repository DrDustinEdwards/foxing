import Link from 'next/link'
import { formatRelativeDate } from '@foxing/utils'
import type { EarnedBadge } from '@/lib/badges'

interface Props {
  username: string
  badges: EarnedBadge[]
}

export function BadgesSection({ username, badges }: Props) {
  if (badges.length === 0) return null
  const visible = badges.slice(0, 8)
  const more = badges.length - visible.length
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        Badges
      </h2>
      <ul className="flex flex-wrap gap-2">
        {visible.map((b) => (
          <li key={b.id}>
            <span
              title={`${b.description ?? b.name}\nEarned ${formatRelativeDate(b.earned_at)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-sunken px-3 py-1 font-dm-sans text-xs text-text-secondary"
            >
              {b.icon && <span aria-hidden="true">{b.icon}</span>}
              {b.name}
            </span>
          </li>
        ))}
        {more > 0 && (
          <li>
            <Link
              href={`/u/${username}/badges`}
              className="inline-flex items-center rounded-full border border-border-subtle bg-bg-sunken px-3 py-1 font-dm-sans text-xs text-brand-text hover:bg-bg-hover"
            >
              +{more} more
            </Link>
          </li>
        )}
      </ul>
      <Link
        href={`/u/${username}/badges`}
        className="mt-3 inline-block font-dm-sans text-xs text-brand-text hover:underline"
      >
        View all badges
      </Link>
    </section>
  )
}
