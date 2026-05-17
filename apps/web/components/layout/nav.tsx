'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

interface NavUser {
  username: string
  display_name: string
  avatar_url: string | null
}

interface NavProps {
  user: NavUser | null
}

const PRIMARY_LINKS = [
  { href: '/discover', label: 'Discover' },
  { href: '/books', label: 'Books' },
  { href: '/clubs', label: 'Clubs' },
  { href: '/people', label: 'People' },
] as const

export function Nav({ user }: NavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
          {PRIMARY_LINKS.map((link) => (
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
                <AccountMenu username={user.username} onClose={() => setMenuOpen(false)} />
              )}
            </div>
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
            {PRIMARY_LINKS.map((link) => (
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

function AccountMenu({
  username,
  onClose,
}: {
  username: string
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
