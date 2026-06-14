'use client'

/**
 * Universal command palette (Consumer B). Cmd/Ctrl+K or the header search icon
 * opens it anywhere. It consumes the shared search core: Layer 1 via
 * useFederatedSearch (the /api/search federated endpoint, RLS as the viewer) and
 * the SearchHit shape from Layer 2. cmdk owns keyboard nav / focus trap / Esc;
 * results are grouped by entity with counts + cover thumbnails. Empty state shows
 * recent searches + global navigation commands.
 *
 * Results render as compact cmdk items (not the shared card renderer) because the
 * palette needs cmdk's roving-focus Command.Item for keyboard nav -- the card
 * renderer (SearchResultItem) stays on the /search page.
 */
import { Command } from 'cmdk'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useFederatedSearch } from '@/lib/search/hooks'
import { SearchQueryProvider } from '@/lib/search/provider'
import type { SearchEntity, SearchHit } from '@/lib/search/types'

const OPEN_EVENT = 'foxing:open-command-palette'

/** Open the palette from anywhere (e.g. the header search icon). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

const RECENTS_KEY = 'foxing:recent-searches'
const MAX_RECENTS = 6

const NAV_COMMANDS: Array<{ label: string; href: string }> = [
  { label: 'Browse books', href: '/books' },
  { label: 'Reading clubs', href: '/clubs' },
  { label: 'Celebrity picks', href: '/book-clubs/picks' },
  { label: 'Reading lists', href: '/lists' },
  { label: 'Quotes', href: '/quotes' },
  { label: 'Journal', href: '/journal/archive' },
  { label: 'Readers', href: '/people' },
]

/** Per-entity "see all" browse path (omitted entities have no browse page). */
const SEE_ALL: Partial<Record<SearchEntity, (q: string) => string>> = {
  book: (q) => `/books?q=${encodeURIComponent(q)}`,
  club: (q) => `/clubs?q=${encodeURIComponent(q)}`,
  person: (q) => `/people?q=${encodeURIComponent(q)}`,
  list: (q) => `/lists?q=${encodeURIComponent(q)}`,
  quote: (q) => `/quotes?q=${encodeURIComponent(q)}`,
  journal: (q) => `/journal/archive?q=${encodeURIComponent(q)}`,
  pick: (q) => `/book-clubs/picks?q=${encodeURIComponent(q)}`,
}

export function CommandPalette() {
  return (
    <SearchQueryProvider>
      <CommandPaletteInner />
    </SearchQueryProvider>
  )
}

function CommandPaletteInner() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [recents, setRecents] = useState<string[]>([])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setInput('')
      setQuery('')
      return
    }
    try {
      const raw = localStorage.getItem(RECENTS_KEY)
      setRecents(raw ? (JSON.parse(raw) as string[]) : [])
    } catch {
      setRecents([])
    }
  }, [open])

  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 200)
    return () => clearTimeout(t)
  }, [input])

  const { data, isFetching } = useFederatedSearch(
    { query, perEntityLimit: 5 },
    { enabled: open },
  )

  const recordRecent = useCallback(
    (term: string) => {
      const t = term.trim()
      if (!t) return
      try {
        const next = [t, ...recents.filter((r) => r !== t)].slice(0, MAX_RECENTS)
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
      } catch {
        // localStorage can throw in some embedded contexts; recents are optional.
      }
    },
    [recents],
  )

  const go = useCallback(
    (href: string, term?: string) => {
      if (term) recordRecent(term)
      setOpen(false)
      router.push(href)
    },
    [router, recordRecent],
  )

  const groups = data?.groups ?? []
  const hasQuery = query.length > 0

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Search Foxing"
      shouldFilter={false}
      loop
      overlayClassName="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[12vh] z-[101] w-[min(38rem,92vw)] -translate-x-1/2"
      className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-lg"
    >
      <Command.Input
        value={input}
        onValueChange={setInput}
        placeholder="Search books, people, clubs, quotes..."
        className="w-full border-b border-border-subtle bg-transparent px-4 py-3.5 font-dm-sans text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
      />
      <Command.List className="max-h-[60vh] overflow-y-auto overscroll-contain p-2">
        {!hasQuery && (
          <>
            {recents.length > 0 && (
              <Command.Group
                heading="Recent"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-dm-mono [&_[cmdk-group-heading]]:text-[0.625rem] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.15em] [&_[cmdk-group-heading]]:text-text-tertiary"
              >
                {recents.map((r) => (
                  <Command.Item
                    key={`recent-${r}`}
                    value={`recent-${r}`}
                    onSelect={() => setInput(r)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 font-dm-sans text-sm text-text-secondary data-[selected=true]:bg-bg-hover"
                  >
                    {r}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            <Command.Group
              heading="Go to"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-dm-mono [&_[cmdk-group-heading]]:text-[0.625rem] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.15em] [&_[cmdk-group-heading]]:text-text-tertiary"
            >
              {NAV_COMMANDS.map((c) => (
                <Command.Item
                  key={c.href}
                  value={c.label}
                  onSelect={() => go(c.href)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 font-dm-sans text-sm text-text-primary data-[selected=true]:bg-bg-hover"
                >
                  {c.label}
                </Command.Item>
              ))}
            </Command.Group>
          </>
        )}

        {hasQuery && (
          <>
            {isFetching && groups.length === 0 && (
              <p className="px-2 py-6 text-center font-dm-sans text-sm text-text-tertiary">
                Searching...
              </p>
            )}
            {!isFetching && groups.length === 0 && (
              <p className="px-2 py-6 text-center font-dm-sans text-sm text-text-tertiary">
                No results for &ldquo;{query}&rdquo;.
              </p>
            )}
            {groups.map((group) => {
              const seeAll = SEE_ALL[group.entity]
              return (
                <Command.Group
                  key={group.entity}
                  heading={`${group.label} (${group.total})`}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-dm-mono [&_[cmdk-group-heading]]:text-[0.625rem] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.15em] [&_[cmdk-group-heading]]:text-text-tertiary"
                >
                  {group.hits.map((hit) => (
                    <PaletteItem
                      key={`${hit.entity}-${hit.id}`}
                      hit={hit}
                      onSelect={() => go(hit.href, query)}
                    />
                  ))}
                  {seeAll && group.total > group.hits.length && (
                    <Command.Item
                      value={`see-all-${group.entity}`}
                      onSelect={() => go(seeAll(query), query)}
                      className="flex cursor-pointer items-center rounded-lg px-2 py-2 font-dm-sans text-xs text-brand-text data-[selected=true]:bg-bg-hover"
                    >
                      See all {group.total} {group.label.toLowerCase()}
                    </Command.Item>
                  )}
                </Command.Group>
              )
            })}
          </>
        )}
      </Command.List>
      <div className="flex items-center justify-end gap-3 border-t border-border-subtle px-3 py-2 font-dm-mono text-[0.625rem] text-text-tertiary">
        <span>Enter to open</span>
        <span>Esc to close</span>
      </div>
    </Command.Dialog>
  )
}

function PaletteItem({
  hit,
  onSelect,
}: {
  hit: SearchHit
  onSelect: () => void
}) {
  return (
    <Command.Item
      value={`${hit.entity}-${hit.id}-${hit.title}`}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 data-[selected=true]:bg-bg-hover"
    >
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-bg-sunken">
        {hit.imageUrl && (
          <Image src={hit.imageUrl} alt="" fill sizes="36px" className="object-cover" />
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-dm-sans text-sm text-text-primary">
          {hit.title}
        </span>
        {hit.subtitle && (
          <span className="truncate font-dm-sans text-xs text-text-tertiary">
            {hit.subtitle}
          </span>
        )}
      </div>
    </Command.Item>
  )
}
