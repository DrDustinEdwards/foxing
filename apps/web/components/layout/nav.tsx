'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

interface NavUser {
  username: string
  display_name: string
  avatar_url: string | null
  is_admin: boolean
}

interface NavProps {
  user: NavUser | null
  unreadNotifications?: number
}

const PRIMARY_LINKS = [
  { href: '/discover', label: 'Discover' },
  { href: '/books', label: 'Books' },
  { href: '/clubs', label: 'Clubs' },
  { href: '/people', label: 'People' },
  { href: '/journal', label: 'Journal' },
] as const

const BOOK_CLUBS_ITEMS = [
  {
    href: '/book-clubs',
    label: 'Celebrity Picks',
    description: 'Oprah, Reese, Jenna, and more',
  },
  {
    href: '/book-of-the-month',
    label: 'Book of the Month',
    description: "Foxing's monthly pick",
  },
] as const

const MOBILE_LINKS = [
  { href: '/discover', label: 'Discover' },
  { href: '/books', label: 'Books' },
  { href: '/clubs', label: 'Reading Clubs' },
  { href: '/book-clubs', label: 'Celebrity Book Club Picks' },
  { href: '/book-of-the-month', label: 'Book of the Month' },
  { href: '/people', label: 'People' },
  { href: '/journal', label: 'Journal' },
] as const

export function Nav({ user, unreadNotifications = 0 }: NavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [bookClubsOpen, setBookClubsOpen] = useState(false)
  const bookClubsRef = useRef<HTMLLIElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (
        bookClubsRef.current &&
        !bookClubsRef.current.contains(event.target as Node)
      ) {
        setBookClubsOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function openBookClubs() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setBookClubsOpen(true)
  }

  function scheduleCloseBookClubs() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setBookClubsOpen(false), 150)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-bg-surface shadow-sm">
      <nav className="mx-auto flex h-14 w-full max-w-page items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 font-fraunces text-xl text-brand-ui"
          >
            <span aria-hidden="true">🦊</span>
            <span>Foxing</span>
          </Link>
        </div>

        <ul className="hidden items-center gap-6 md:flex">
          <li>
            <Link
              href="/discover"
              className="font-dm-sans text-sm text-text-secondary hover:text-text-primary"
            >
              Discover
            </Link>
          </li>
          <li>
            <Link
              href="/books"
              className="font-dm-sans text-sm text-text-secondary hover:text-text-primary"
            >
              Books
            </Link>
          </li>
          <li>
            <Link
              href="/clubs"
              className="font-dm-sans text-sm text-text-secondary hover:text-text-primary"
            >
              Clubs
            </Link>
          </li>
          <li
            ref={bookClubsRef}
            className="relative"
            onMouseEnter={openBookClubs}
            onMouseLeave={scheduleCloseBookClubs}
          >
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={bookClubsOpen}
              onClick={() => setBookClubsOpen((v) => !v)}
              onFocus={openBookClubs}
              className="flex items-center gap-1 font-dm-sans text-sm text-text-secondary hover:text-text-primary"
            >
              Book Clubs
              <ChevronDownIcon />
            </button>
            {bookClubsOpen && (
              <BookClubsDropdown onClose={() => setBookClubsOpen(false)} />
            )}
          </li>
          {PRIMARY_LINKS.filter(
            (link) => !['/discover', '/books', '/clubs'].includes(link.href),
          ).map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="font-dm-sans text-sm text-text-secondary hover:text-text-primary"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            className="hidden h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover md:inline-flex"
            aria-label="Search"
          >
            <SearchIcon />
          </Link>

          {user ? (
            <>
              <Link
                href="/notifications"
                aria-label={
                  unreadNotifications > 0
                    ? `Notifications, ${unreadNotifications} unread`
                    : 'Notifications'
                }
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover"
              >
                <BellIcon />
                {unreadNotifications > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-ui px-1 font-dm-mono text-[10px] font-medium text-text-on-brand"
                  >
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </Link>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="rounded-full"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label={`Account menu for ${user.display_name}`}
                >
                  <Avatar
                    src={user.avatar_url}
                    name={user.display_name}
                    size="md"
                  />
                </button>
                {menuOpen && (
                  <AccountMenu
                    username={user.username}
                    isAdmin={user.is_admin}
                    onClose={() => setMenuOpen(false)}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/sign-up">
                <Button variant="primary" size="sm">Join free</Button>
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover md:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <HamburgerIcon open={mobileOpen} />
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="border-t border-border-subtle bg-bg-surface md:hidden">
          <ul className="flex flex-col px-6 py-3">
            {MOBILE_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block py-2 font-dm-sans text-base text-text-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/search"
                className="block py-2 font-dm-sans text-base text-text-primary"
                onClick={() => setMobileOpen(false)}
              >
                Search
              </Link>
            </li>
            {!user && (
              <li className="mt-2 flex gap-2 border-t border-border-subtle pt-3">
                <Link href="/sign-in" className="flex-1">
                  <Button variant="ghost" size="md" fullWidth>Sign in</Button>
                </Link>
                <Link href="/sign-up" className="flex-1">
                  <Button variant="primary" size="md" fullWidth>Join free</Button>
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}
    </header>
  )
}

function BookClubsDropdown({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="menu"
      className="absolute left-1/2 top-8 z-50 w-72 -translate-x-1/2 overflow-hidden rounded-md border border-border-subtle bg-bg-elevated shadow-md"
    >
      <ul className="flex flex-col py-1">
        {BOOK_CLUBS_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              role="menuitem"
              onClick={onClose}
              className="flex items-start gap-3 px-4 py-3 hover:bg-bg-hover"
            >
              {item.href === '/book-clubs' ? (
                <UsersIcon />
              ) : (
                <StarIcon />
              )}
              <div className="flex flex-col">
                <span className="font-dm-sans text-sm font-medium text-text-primary">
                  {item.label}
                </span>
                <span className="font-dm-sans text-xs text-text-tertiary">
                  {item.description}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AccountMenu({
  username,
  isAdmin,
  onClose,
}: {
  username: string
  isAdmin: boolean
  onClose: () => void
}) {
  const items = [
    { href: '/library', label: 'My library' },
    { href: '/diary', label: 'Reading diary' },
    { href: '/stats', label: 'Stats' },
    { href: `/u/${username}`, label: 'Profile' },
    { href: '/settings', label: 'Settings' },
  ]
  return (
    <div
      role="menu"
      className={cn(
        'absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated shadow-md',
      )}
    >
      <ul className="flex flex-col py-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              role="menuitem"
              className="block px-4 py-2 font-dm-sans text-sm text-text-primary hover:bg-bg-hover"
              onClick={onClose}
            >
              {item.label}
            </Link>
          </li>
        ))}
        {isAdmin && (
          <li className="border-t border-border-subtle">
            <Link
              href="/admin"
              role="menuitem"
              className="flex items-center gap-2 px-4 py-2 font-dm-sans text-sm text-brand-ui hover:bg-bg-hover"
              onClick={onClose}
            >
              <ShieldIcon />
              Admin dashboard
            </Link>
          </li>
        )}
        <li className="border-t border-border-subtle">
          <form action="/sign-out" method="post">
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-4 py-2 text-left font-dm-sans text-sm text-text-primary hover:bg-bg-hover"
            >
              Sign out
            </button>
          </form>
        </li>
      </ul>
    </div>
  )
}

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 text-brand-ui"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 text-brand-ui"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {open ? (
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
  )
}
