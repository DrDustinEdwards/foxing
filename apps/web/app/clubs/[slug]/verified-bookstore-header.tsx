import type { PublicClub } from '@/lib/queries'

const DAY_LABELS: Array<{ key: string; label: string }> = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

export function VerifiedBookstoreHeader({ club }: { club: PublicClub }) {
  if (club.club_type !== 'bookstore' || !club.is_verified) return null
  const address = [
    club.bookstore_address,
    [club.bookstore_city, club.bookstore_state].filter(Boolean).join(', '),
    club.bookstore_zip,
  ]
    .filter(Boolean)
    .join(', ')
  const hours = club.bookstore_hours ?? null
  return (
    <section className="mt-6 flex flex-col gap-4 rounded-lg border border-border-subtle bg-bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <VerifiedBadge />
        {club.bookstore_city && (
          <span className="font-dm-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">
            {club.bookstore_city}
            {club.bookstore_state ? `, ${club.bookstore_state}` : ''}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-1 gap-2 font-dm-sans text-sm text-text-secondary sm:grid-cols-2">
        {address && (
          <div>
            <dt className="font-dm-mono text-[0.6875rem] uppercase tracking-wider text-text-tertiary">
              Address
            </dt>
            <dd>{address}</dd>
          </div>
        )}
        {club.bookstore_phone && (
          <div>
            <dt className="font-dm-mono text-[0.6875rem] uppercase tracking-wider text-text-tertiary">
              Phone
            </dt>
            <dd>
              <a
                href={`tel:${club.bookstore_phone}`}
                className="text-brand-text hover:underline"
              >
                {club.bookstore_phone}
              </a>
            </dd>
          </div>
        )}
        {club.bookstore_website && (
          <div>
            <dt className="font-dm-mono text-[0.6875rem] uppercase tracking-wider text-text-tertiary">
              Website
            </dt>
            <dd>
              <a
                href={club.bookstore_website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-text hover:underline"
              >
                {club.bookstore_website.replace(/^https?:\/\//, '')}
              </a>
            </dd>
          </div>
        )}
      </dl>
      {hours && Object.keys(hours).length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-dm-sans text-text-secondary">
            Hours
          </summary>
          <ul className="mt-2 grid grid-cols-1 gap-1 font-dm-sans text-sm text-text-secondary sm:grid-cols-2">
            {DAY_LABELS.filter((d) => hours[d.key]).map((d) => (
              <li key={d.key} className="flex justify-between gap-3">
                <span className="text-text-tertiary">{d.label}</span>
                <span>{hours[d.key]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-ui px-2 py-1 font-dm-mono text-[0.6875rem] uppercase tracking-wider text-text-on-brand">
      <FoxIcon />
      Verified Bookstore
    </span>
  )
}

function FoxIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2 4 5l1 7c.7 4 3.7 7 7 8 3.3-1 6.3-4 7-8l1-7-8-3Zm-3 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm6 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-3 4 2 2-2 1-2-1 2-2Z" />
    </svg>
  )
}
