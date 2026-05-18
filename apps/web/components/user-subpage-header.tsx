import Link from 'next/link'
import { cn } from '@/lib/cn'

export type UserSubpageSection =
  | 'library'
  | 'diary'
  | 'lists'
  | 'highlights'
  | 'reviews'

const SECTIONS: Array<{ id: UserSubpageSection; label: string }> = [
  { id: 'library', label: 'Books' },
  { id: 'diary', label: 'Diary' },
  { id: 'lists', label: 'Lists' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'reviews', label: 'Reviews' },
]

interface UserSubpageHeaderProps {
  username: string
  displayName: string
  section: UserSubpageSection
}

export function UserSubpageHeader({
  username,
  displayName,
  section,
}: UserSubpageHeaderProps) {
  const label = SECTIONS.find((s) => s.id === section)?.label
  return (
    <header className="flex flex-col gap-3">
      <Link
        href={`/u/${username}`}
        className="font-dm-sans text-sm text-text-tertiary hover:text-text-primary"
      >
        @{username}
      </Link>
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        {displayName}&apos;s {label}
      </h1>
      <nav className="flex flex-wrap gap-1">
        {SECTIONS.map((s) => (
          <Link
            key={s.id}
            href={`/u/${username}/${s.id}`}
            className={cn(
              'rounded-full px-3 py-1 font-dm-sans text-xs',
              section === s.id
                ? 'bg-brand-subtle text-brand-subtle-text'
                : 'bg-bg-sunken text-text-secondary hover:bg-bg-hover',
            )}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
