'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment, useRef, useState } from 'react'
import {
  BellIcon,
  BookOpenIcon,
  ChartBarIcon,
  FlagIcon,
  HouseIcon,
  PencilIcon,
  PlugIcon,
  UsersIcon,
  UsersThreeIcon,
} from '@/components/icons'
import { cn } from '@/lib/cn'

interface NavItem {
  href: string
  label: string
  icon: typeof HouseIcon
  exact?: boolean
}

interface NavSection {
  key: string
  label: string | null
  railName: string
  railIcon: typeof HouseIcon
  items: NavItem[]
}

const SECTIONS: NavSection[] = [
  {
    key: 'overview',
    label: null,
    railName: 'Overview',
    railIcon: HouseIcon,
    items: [
      { href: '/admin', label: 'Overview', icon: HouseIcon, exact: true },
    ],
  },
  {
    key: 'catalog',
    label: 'Catalog',
    railName: 'Catalog',
    railIcon: BookOpenIcon,
    items: [
      { href: '/admin/books', label: 'Books', icon: BookOpenIcon },
      { href: '/admin/book-of-month', label: 'Book of Month', icon: BookOpenIcon },
      { href: '/admin/celebrity-picks', label: 'Celebrity Picks', icon: UsersIcon },
      { href: '/admin/journal', label: 'Journal', icon: PencilIcon },
    ],
  },
  {
    key: 'community',
    label: 'Community',
    railName: 'Community',
    railIcon: UsersIcon,
    items: [
      { href: '/admin/users', label: 'Users', icon: UsersIcon },
      { href: '/admin/clubs', label: 'Clubs', icon: UsersThreeIcon },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    railName: 'Operations',
    railIcon: BellIcon,
    items: [
      { href: '/admin/notifications', label: 'Notifications', icon: BellIcon },
      { href: '/admin/bookstores', label: 'Bookstores', icon: BookOpenIcon },
      { href: '/admin/content', label: 'Content', icon: FlagIcon },
      { href: '/admin/mcp', label: 'MCP Servers', icon: PlugIcon },
    ],
  },
  {
    key: 'data',
    label: 'Data',
    railName: 'Data',
    railIcon: ChartBarIcon,
    items: [
      { href: '/admin/analytics', label: 'Analytics', icon: ChartBarIcon },
      { href: '/admin/404s', label: '404 log', icon: FlagIcon },
    ],
  },
]

interface Props {
  adminName: string
}

function isItemActive(
  pathname: string,
  href: string,
  exact: boolean | undefined,
): boolean {
  return exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`)
}

function activeGroup(pathname: string): string | null {
  for (const section of SECTIONS) {
    for (const item of section.items) {
      if (isItemActive(pathname, item.href, item.exact)) return section.key
    }
  }
  return null
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AdminSidebar({ adminName }: Props) {
  const pathname = usePathname() ?? ''
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function active(href: string, exact: boolean | undefined): boolean {
    return isItemActive(pathname, href, exact)
  }

  function openFlyout(key: string) {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpenGroup(key)
  }

  function scheduleFlyoutClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpenGroup(null), 100)
  }

  const currentGroup = activeGroup(pathname)
  const openSection = SECTIONS.find((s) => s.key === openGroup) ?? null

  return (
    <>
      {/* Mobile top bar */}
      <header
        data-mode="dark"
        className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border-default bg-bg-base px-4 text-text-primary md:hidden"
      >
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 font-fraunces text-lg text-brand-ui"
        >
          <span aria-hidden="true">🦊</span>
          Admin
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="Toggle admin menu"
          className="rounded-md p-2 hover:bg-bg-hover"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {mobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </header>

      {mobileOpen && (
        <nav
          aria-label="Admin (mobile)"
          data-mode="dark"
          className="border-b border-border-default bg-bg-base text-text-primary md:hidden"
        >
          <ul className="flex flex-col px-2 py-2">
            {SECTIONS.map((section) => (
              <Fragment key={section.label ?? 'top'}>
                {section.label && (
                  <li
                    aria-hidden="true"
                    className="px-3 pb-1 pt-4 font-dm-mono text-[0.625rem] uppercase tracking-[0.14em] text-text-tertiary"
                  >
                    {section.label}
                  </li>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = active(item.href, item.exact)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded px-3 py-1.5 font-dm-sans text-sm',
                          isActive
                            ? 'bg-brand-subtle text-text-primary'
                            : 'text-text-secondary hover:bg-bg-hover',
                        )}
                      >
                        <Icon size={18} />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </Fragment>
            ))}
          </ul>
        </nav>
      )}

      {/* Desktop rail */}
      <aside
        aria-label="Admin"
        data-mode="dark"
        className="fixed bottom-0 left-0 top-0 z-30 hidden w-14 flex-col border-r border-border-default bg-bg-base text-text-primary md:flex"
      >
        <div className="flex justify-center border-b border-border-default py-4">
          <Link
            href="/admin"
            aria-label="Admin home"
            className="inline-flex h-10 w-10 items-center justify-center font-fraunces text-xl text-brand-ui"
          >
            <span aria-hidden="true">🦊</span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-2">
          {SECTIONS.map((section) => {
            const Icon = section.railIcon
            const isGroupActive = currentGroup === section.key
            const isOverview = section.key === 'overview'
            const railClass = cn(
              'mx-1 flex h-10 w-10 items-center justify-center self-center rounded-md border-l-2 transition-colors',
              isGroupActive
                ? 'border-brand-ui bg-brand-subtle text-brand-ui'
                : 'border-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            )
            const tooltip =
              openGroup === section.key ? null : (
                <span
                  role="tooltip"
                  className="absolute left-14 top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded bg-[var(--tooltip-bg)] px-2 py-1 text-xs text-[var(--tooltip-text)] group-hover:block"
                >
                  {section.railName}
                </span>
              )

            if (isOverview) {
              return (
                <div key={section.key} className="group relative">
                  <Link
                    href="/admin"
                    aria-label={section.railName}
                    className={railClass}
                    onMouseEnter={() => {
                      if (closeTimer.current) clearTimeout(closeTimer.current)
                      setOpenGroup(null)
                    }}
                  >
                    <Icon size={20} />
                  </Link>
                  {tooltip}
                </div>
              )
            }

            return (
              <div
                key={section.key}
                className="group relative"
                onMouseEnter={() => openFlyout(section.key)}
                onMouseLeave={scheduleFlyoutClose}
              >
                <button
                  type="button"
                  aria-label={section.railName}
                  aria-expanded={openGroup === section.key}
                  onClick={() =>
                    setOpenGroup((v) =>
                      v === section.key ? null : section.key,
                    )
                  }
                  className={railClass}
                >
                  <Icon size={20} />
                </button>
                {tooltip}
              </div>
            )
          })}
        </nav>

        <div className="flex justify-center border-t border-border-default py-3">
          <Link
            href="/home"
            aria-label="Back to app"
            className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-hover font-dm-sans text-xs text-text-primary hover:bg-bg-selected"
            title={adminName}
          >
            {initials(adminName)}
            <span
              role="tooltip"
              className="absolute left-14 top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded bg-[var(--tooltip-bg)] px-2 py-1 text-xs text-[var(--tooltip-text)] group-hover:block"
            >
              Back to app
            </span>
          </Link>
        </div>
      </aside>

      {/* Flyout panel */}
      {openSection && openSection.key !== 'overview' && (
        <div
          aria-label={openSection.railName}
          data-mode="dark"
          className="fixed bottom-0 left-14 top-0 z-40 hidden w-48 border-r border-border-default bg-bg-surface text-text-primary shadow-xl md:block"
          onMouseEnter={() => openFlyout(openSection.key)}
          onMouseLeave={scheduleFlyoutClose}
        >
          <p className="px-4 pb-2 pt-5 font-dm-mono text-[0.625rem] uppercase tracking-[0.14em] text-text-tertiary">
            {openSection.railName}
          </p>
          <ul>
            {openSection.items.map((item) => {
              const Icon = item.icon
              const isActive = active(item.href, item.exact)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpenGroup(null)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2 font-dm-sans text-sm transition-colors',
                      isActive
                        ? 'bg-brand-subtle text-text-primary'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
