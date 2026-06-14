import type { SearchHit } from '@/lib/search/types'
import { ResultCard } from './result-card'

/**
 * Stub result cards for entities without a dedicated card yet. Each renders the
 * shared ResultCard with an entity glyph; flesh out individually as the
 * consumers ship. Inline SVG only (no icon libraries on web).
 */

function Glyph({ path }: { path: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}

const ICONS = {
  author: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  quote: 'M7 7h4v6H7zM13 7h4v6h-4zM7 13c0 2-1 3-3 4M13 13c0 2-1 3-3 4',
  journal: 'M4 4h11a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2zM8 8h6M8 12h6',
  pick: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
} as const

export function AuthorCard({ hit }: { hit: SearchHit<'author'> }) {
  return (
    <ResultCard
      href={hit.href}
      title={hit.title}
      subtitle="Author"
      shape="avatar"
      icon={<Glyph path={ICONS.author} />}
    />
  )
}

export function ListCard({ hit }: { hit: SearchHit<'list'> }) {
  return (
    <ResultCard
      href={hit.href}
      title={hit.title}
      subtitle={hit.subtitle ?? 'Reading list'}
      imageUrl={hit.imageUrl}
      icon={<Glyph path={ICONS.list} />}
    />
  )
}

export function QuoteCard({ hit }: { hit: SearchHit<'quote'> }) {
  return (
    <ResultCard
      href={hit.href}
      title={hit.title}
      subtitle={hit.subtitle}
      icon={<Glyph path={ICONS.quote} />}
    />
  )
}

export function JournalCard({ hit }: { hit: SearchHit<'journal'> }) {
  return (
    <ResultCard
      href={hit.href}
      title={hit.title}
      subtitle={hit.subtitle ?? 'Journal'}
      imageUrl={hit.imageUrl}
      shape="cover"
      icon={<Glyph path={ICONS.journal} />}
    />
  )
}

export function PickCard({ hit }: { hit: SearchHit<'pick'> }) {
  return (
    <ResultCard
      href={hit.href}
      title={hit.title}
      subtitle={hit.subtitle}
      imageUrl={hit.imageUrl}
      shape="cover"
      icon={<Glyph path={ICONS.pick} />}
    />
  )
}
