'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment, useState } from 'react'
import {
  BellIcon,
  BookOpenIcon,
  ChartBarIcon,
  FlagIcon,
  HouseIcon,
  PencilIcon,
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
  label: string | null
  items: NavItem[]
}

const SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { href: '/admin', label: 'Overview', icon: HouseIcon, exact: true },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/admin/books', label: 'Books', icon: BookOpenIcon },
      { href: '/admin/book-of-month', label: 'Book of Month', icon: BookOpenIcon },
      { href: '/admin/celebrity-picks', label: 'Celebrity Picks', icon: UsersIcon },
      { href: '/admin/journal', label: 'Journal', icon: PencilIcon },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/admin/users', label: 'Users', icon: UsersIcon },
      { href: '/admin/clubs', label: 'Clubs', icon: UsersThreeIcon },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/notifications', label: 'Notifications', icon: BellIcon },
      { href: '/admin/bookstores', label: 'Bookstores', icon: BookOpenIcon },
      { href: '/admin/content', label: 'Content', icon: FlagIcon },
    ],
  },
  {
    label: 'Data',
    items: [
      { href: '/admin/analytics', label: 'Analytics', icon: ChartBarIcon },
      { href: '/admin/404s', label: '404 log', icon: FlagIcon },
    ],
  },
]

interface Props {
  adminName: string
}

export function AdminSidebar({ adminName }: Props) {
  const pathname = usePathname() ?? ''
  const [mobileOpen, setMobileOpen] = useState(false)

  function active(href: string, exact: boolean | undefined): boolean {
    return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#3A2C22] bg-[#16100B] px-4 text-[#F5EDDE] md:hidden">
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
          className="rounded-md p-2 hover:bg-[#261C13]"
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
          className="border-b border-[#3A2C22] bg-[#16100B] text-[#F5EDDE] md:hidden"
        >
          <ul className="flex flex-col px-2 py-2">
            {SECTIONS.map((section) => (
              <Fragment key={section.label ?? 'top'}>
                {section.label && (
                  <li
                    aria-hidden="true"
                    className="px-3 pb-1 pt-4 font-dm-mono text-[10px] uppercase tracking-[0.14em] text-[#A28269]"
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
                            ? 'bg-[#2E1C0E] text-[#F5EDDE]'
                            : 'text-[#C4AE96] hover:bg-[#261C13]',
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

      {/* Desktop sidebar */}
      <aside
        aria-label="Admin"
        className="fixed bottom-0 left-0 top-0 z-30 hidden w-60 flex-col border-r border-[#3A2C22] bg-[#16100B] text-[#F5EDDE] md:flex"
      >
        <div className="border-b border-[#3A2C22] px-5 py-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 font-fraunces text-xl text-brand-ui"
          >
            <span aria-hidden="true">🦊</span>
            Foxing
          </Link>
          <p className="mt-1 font-dm-mono text-[11px] uppercase tracking-wider text-[#A28269]">
            Admin
          </p>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 py-3">
          {SECTIONS.map((section) => (
            <Fragment key={section.label ?? 'top'}>
              {section.label && (
                <li
                  aria-hidden="true"
                  className="px-3 pb-1 pt-4 font-dm-mono text-[10px] uppercase tracking-[0.14em] text-[#A28269]"
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
                      className={cn(
                        'mb-1 flex items-center gap-3 rounded-md border-l-2 px-3 py-1.5 font-dm-sans text-sm transition-colors',
                        isActive
                          ? 'border-brand-ui bg-[#2E1C0E] text-[#F5EDDE]'
                          : 'border-transparent text-[#C4AE96] hover:bg-[#261C13] hover:text-[#F5EDDE]',
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
        <div className="border-t border-[#3A2C22] px-5 py-3">
          <p className="font-dm-mono text-[11px] text-[#A28269]">
            Signed in as
          </p>
          <p className="font-dm-sans text-sm text-[#F5EDDE]">{adminName}</p>
          <Link
            href="/home"
            className="mt-2 inline-block font-dm-sans text-xs text-[#A28269] hover:text-[#F5EDDE]"
          >
            ← Back to app
          </Link>
        </div>
      </aside>
    </>
  )
}
