'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Select } from '@/components/ui/select'

export type ClubTabKey =
  | 'overview'
  | 'discussions'
  | 'meetings'
  | 'polls'
  | 'schedule'
  | 'members'
  | 'moderation'
  | 'settings'

interface RailItem {
  key: ClubTabKey
  label: string
}

const MAIN_ITEMS: RailItem[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'discussions', label: 'Discussions' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'polls', label: 'Polls' },
  { key: 'schedule', label: 'Reading Schedule' },
  { key: 'members', label: 'Members' },
]

// Admin/mod-only, pinned to the BOTTOM of the rail.
const MOD_ITEMS: RailItem[] = [
  { key: 'moderation', label: 'Moderation' },
  { key: 'settings', label: 'Settings' },
]

/**
 * Club entity hub: an in-page left rail (scoped to the club content area, NOT a
 * full-viewport admin rail) + a content pane that renders only the active
 * section -- so empty sections never sit in the scroll. On phones the rail
 * collapses to a section <Select>. Sections are server-rendered and passed in
 * as nodes; only the active one mounts.
 */
export function ClubWorkspace({
  defaultTab,
  available,
  sections,
}: {
  defaultTab: ClubTabKey
  available: ClubTabKey[]
  sections: Partial<Record<ClubTabKey, ReactNode>>
}) {
  const [active, setActive] = useState<ClubTabKey>(defaultTab)
  const has = (k: ClubTabKey) => available.includes(k)
  const main = MAIN_ITEMS.filter((i) => has(i.key))
  const mod = MOD_ITEMS.filter((i) => has(i.key))
  const allItems = [...main, ...mod]

  return (
    <div className="mt-8 flex flex-col gap-6 md:flex-row md:gap-8">
      {/* Mobile: section dropdown */}
      <div className="md:hidden">
        <Select
          aria-label="Club section"
          value={active}
          onChange={(v) => setActive(v as ClubTabKey)}
          className="w-full"
          options={allItems.map((i) => ({ value: i.key, label: i.label }))}
        />
      </div>

      {/* Desktop: scoped left rail */}
      <nav
        aria-label="Club sections"
        className="hidden shrink-0 md:block md:w-48 md:self-start md:sticky md:top-24"
      >
        <ul className="flex flex-col gap-0.5">
          {main.map((item) => (
            <RailButton
              key={item.key}
              item={item}
              active={active === item.key}
              onSelect={setActive}
            />
          ))}
        </ul>
        {mod.length > 0 && (
          <ul className="mt-4 flex flex-col gap-0.5 border-t border-border-subtle pt-4">
            {mod.map((item) => (
              <RailButton
                key={item.key}
                item={item}
                active={active === item.key}
                onSelect={setActive}
              />
            ))}
          </ul>
        )}
      </nav>

      <div className="min-w-0 flex-1">{sections[active] ?? null}</div>
    </div>
  )
}

function RailButton({
  item,
  active,
  onSelect,
}: {
  item: RailItem
  active: boolean
  onSelect: (k: ClubTabKey) => void
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={() => onSelect(item.key)}
        className={cn(
          'w-full rounded-md px-3 py-2 text-left font-dm-sans text-sm transition-colors',
          active
            ? 'bg-brand-subtle font-medium text-brand-subtle-text'
            : 'text-text-tertiary hover:bg-bg-hover hover:text-text-primary',
        )}
      >
        {item.label}
      </button>
    </li>
  )
}
