'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FoxMark } from '@/components/ui/fox-mark'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/cn'

interface NavUser {
  username: string
  display_name: string
  avatar_url: string | null
  is_admin: boolean
  subscription_tier: 'free' | 'plus' | 'patron'
}

interface NavProps {
  user: NavUser | null
  unreadNotifications?: number
}

// Primary nav. /clubs (user-created reading clubs) lives in the secondary
// authenticated bar; /book-clubs (celebrity picks) is its own primary
// entry, distinct from /clubs.
const PRIMARY_LINKS = [
  { href: '/books', label: 'Books', match: '/books' },
  { href: '/book-clubs', label: 'Book Clubs', match: '/book-clubs' },
  {
    href: '/book-of-the-month',
    label: 'Book of the Month',
    match: '/book-of-the-month',
  },
  { href: '/journal', label: 'Journal', match: '/journal' },
  { href: '/people', label: 'Community', match: '/people' },
] as const

const BOOKS_MENU_BROWSE = [
  { href: '/books', label: 'All Books' },
  { href: '/discover', label: 'By Mood' },
  { href: '/series', label: 'Series' },
  { href: '/awards', label: 'Award Winners' },
  { href: '/challenges', label: 'Reading Challenges' },
] as const

const BOOKS_MENU_THEMES = [
  'dark',
  'mysterious',
  'adventurous',
  'romantic',
  'funny',
  'reflective',
  'emotional',
  'hopeful',
  'tense',
  'lighthearted',
] as const

const FEATURED_CLUBS = [
  { slug: 'oprah', label: 'Oprah' },
  { slug: 'reese', label: 'Reese' },
  { slug: 'jenna', label: 'Jenna Bush Hager' },
  { slug: 'gma', label: 'GMA' },
  { slug: 'belletrist', label: 'Belletrist' },
  { slug: 'dua-lipa', label: 'Dua Lipa' },
] as const

const MOBILE_LINKS = [
  { href: '/books', label: 'Books' },
  { href: '/discover', label: 'By Mood' },
  { href: '/series', label: 'Series' },
  { href: '/awards', label: 'Award Winners' },
  { href: '/challenges', label: 'Reading Challenges' },
  { href: '/book-clubs', label: 'Celebrity Book Clubs' },
  { href: '/book-of-the-month', label: 'Book of the Month' },
  { href: '/clubs', label: 'Reading Clubs' },
  { href: '/journal', label: 'Journal' },
  { href: '/people', label: 'Community' },
  { href: '/quotes', label: 'Quotes' },
] as const

function currentMonthPath(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `/book-clubs/picks/${y}/${m}`
}

function isActivePath(pathname: string, match: string): boolean {
  if (match === '/') return pathname === '/'
  return pathname === match || pathname.startsWith(`${match}/`)
}

export function Nav({ user, unreadNotifications = 0 }: NavProps) {
  const pathname = usePathname() ?? ''
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openMega, setOpenMega] = useState<'books' | 'book-clubs' | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function openMenu(key: 'books' | 'book-clubs') {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpenMega(key)
  }

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpenMega(null), 150)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-bg-surface shadow-sm">
      <nav className="mx-auto flex h-14 w-full max-w-page items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Link
            href={user ? '/home' : '/'}
            className="flex items-center gap-2 font-fraunces text-xl text-brand-ui"
          >
            <FoxMark size={28} />
            <span>Foxing</span>
          </Link>
        </div>

        <ul className="hidden items-center gap-1 md:flex">
          {PRIMARY_LINKS.map((link) => {
            const isActive = isActivePath(pathname, link.match)
            const hasMega = link.href === '/books' || link.href === '/book-clubs'
            const megaKey = link.href === '/books' ? 'books' : 'book-clubs'
            return (
              <li
                key={link.href}
                className="relative"
                onMouseEnter={
                  hasMega
                    ? () => openMenu(megaKey as 'books' | 'book-clubs')
                    : undefined
                }
                onMouseLeave={hasMega ? scheduleClose : undefined}
              >
                <Link
                  href={link.href}
                  className={cn(
                    'inline-flex h-9 items-center rounded-md px-3 font-dm-sans text-sm transition-colors',
                    isActive
                      ? 'text-brand-text'
                      : 'text-text-secondary hover:text-text-primary',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {link.label}
                </Link>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-ui"
                  />
                )}
                {hasMega && openMega === megaKey && (
                  <MegaMenu
                    kind={megaKey as 'books' | 'book-clubs'}
                    onLinkClick={() => setOpenMega(null)}
                  />
                )}
              </li>
            )
          })}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            className="hidden h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover md:inline-flex"
            aria-label="Search"
          >
            <SearchIcon />
          </Link>

          <ThemeToggle className="hidden md:inline-flex" />

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
              <div className="relative" ref={accountRef}>
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
                  <AccountMenu user={user} onClose={() => setMenuOpen(false)} />
                )}
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button variant="primary" size="sm">
                  Join free
                </Button>
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

      {user && <SecondaryAuthBar pathname={pathname} />}

      {mobileOpen && (
        <MobileSheet
          user={user}
          pathname={pathname}
          onClose={() => setMobileOpen(false)}
        />
      )}
    </header>
  )
}

function SecondaryAuthBar({ pathname }: { pathname: string }) {
  const items = [
    { href: '/home', label: 'Home' },
    { href: '/library', label: 'Library' },
    { href: '/diary', label: 'Diary' },
    { href: '/feed', label: 'Feed' },
    { href: '/clubs', label: 'Clubs' },
    { href: '/people', label: 'People' },
  ]
  return (
    <div className="hidden border-t border-border-subtle bg-bg-sunken md:block">
      <ul className="mx-auto flex h-10 w-full max-w-page items-center gap-1 px-6">
        {items.map((item) => {
          const isActive = isActivePath(pathname, item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex h-7 items-center rounded-md px-3 font-dm-sans text-xs',
                  isActive
                    ? 'bg-brand-subtle text-brand-subtle-text'
                    : 'text-text-tertiary hover:text-text-primary',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function MegaMenu({
  kind,
  onLinkClick,
}: {
  kind: 'books' | 'book-clubs'
  onLinkClick: () => void
}) {
  if (kind === 'books') {
    return (
      <div className="absolute left-1/2 top-9 z-50 w-[520px] -translate-x-1/2 rounded-lg border border-border-subtle bg-bg-elevated p-5 shadow-lg">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="mb-3 font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
              Browse
            </p>
            <ul className="flex flex-col gap-1">
              {BOOKS_MENU_BROWSE.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onLinkClick}
                    role="menuitem"
                    className="block rounded-md px-2 py-1.5 font-dm-sans text-sm text-text-primary hover:bg-bg-hover"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
              Themes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BOOKS_MENU_THEMES.map((theme) => (
                <Link
                  key={theme}
                  href={`/themes/${theme}`}
                  onClick={onLinkClick}
                  role="menuitem"
                  className="rounded-full bg-brand-subtle px-2.5 py-1 font-dm-sans text-xs capitalize text-brand-subtle-text hover:bg-bg-hover"
                >
                  {theme}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute left-1/2 top-9 z-50 w-[440px] -translate-x-1/2 rounded-lg border border-border-subtle bg-bg-elevated p-5 shadow-lg">
      <p className="mb-3 font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        Featured clubs
      </p>
      <ul className="grid grid-cols-2 gap-1">
        {FEATURED_CLUBS.map((club) => (
          <li key={club.slug}>
            <Link
              href={`/book-clubs/${club.slug}`}
              onClick={onLinkClick}
              role="menuitem"
              className="block rounded-md px-2 py-1.5 font-dm-sans text-sm text-text-primary hover:bg-bg-hover"
            >
              {club.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-col gap-1 border-t border-border-subtle pt-3">
        <Link
          href="/book-clubs"
          onClick={onLinkClick}
          role="menuitem"
          className="block rounded-md px-2 py-1.5 font-dm-sans text-sm text-brand-text hover:bg-bg-hover"
        >
          View all 30 clubs →
        </Link>
        <Link
          href={currentMonthPath()}
          onClick={onLinkClick}
          role="menuitem"
          className="block rounded-md px-2 py-1.5 font-dm-sans text-sm text-brand-text hover:bg-bg-hover"
        >
          This month&apos;s picks →
        </Link>
      </div>
    </div>
  )
}

function MobileSheet({
  user,
  pathname,
  onClose,
}: {
  user: NavUser | null
  pathname: string
  onClose: () => void
}) {
  return (
    <div className="border-t border-border-subtle bg-bg-surface md:hidden">
      <ul className="flex flex-col px-6 py-3">
        {user && (
          <li className="border-b border-border-subtle pb-2">
            <p className="font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
              You
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <MobileLink
                href="/home"
                label="Home"
                pathname={pathname}
                onClose={onClose}
              />
              <MobileLink
                href="/library"
                label="My library"
                pathname={pathname}
                onClose={onClose}
              />
              <MobileLink
                href="/diary"
                label="Reading diary"
                pathname={pathname}
                onClose={onClose}
              />
              <MobileLink
                href="/feed"
                label="Feed"
                pathname={pathname}
                onClose={onClose}
              />
              <MobileLink
                href="/clubs"
                label="Reading clubs"
                pathname={pathname}
                onClose={onClose}
              />
            </div>
          </li>
        )}
        {MOBILE_LINKS.map((link) => (
          <li key={link.href}>
            <MobileLink
              href={link.href}
              label={link.label}
              pathname={pathname}
              onClose={onClose}
            />
          </li>
        ))}
        <li>
          <MobileLink
            href="/search"
            label="Search"
            pathname={pathname}
            onClose={onClose}
          />
        </li>
        <li className="mt-3 border-t border-border-subtle pt-3">
          <p className="mb-2 font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            Appearance
          </p>
          <MobileThemePicker />
        </li>
        {!user && (
          <li className="mt-2 flex gap-2 border-t border-border-subtle pt-3">
            <Link href="/sign-in" className="flex-1" onClick={onClose}>
              <Button variant="ghost" size="md" fullWidth>
                Sign in
              </Button>
            </Link>
            <Link href="/sign-up" className="flex-1" onClick={onClose}>
              <Button variant="primary" size="md" fullWidth>
                Join free
              </Button>
            </Link>
          </li>
        )}
      </ul>
    </div>
  )
}

function MobileThemePicker() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    let cancelled = false
    void import('@/lib/theme').then((m) => {
      if (!cancelled) setIsDark(m.resolvedTheme() === 'dark')
    })
    return () => {
      cancelled = true
    }
  }, [])

  function handleToggle() {
    const next: 'light' | 'dark' = isDark ? 'light' : 'dark'
    setIsDark(!isDark)
    void import('@/lib/theme').then((m) => {
      m.setStoredTheme(next)
      m.applyTheme(next)
    })
    void import('@/app/(app)/settings/theme-actions').then((m) =>
      m.saveThemePreference(next),
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-bg-sunken px-3 py-2">
      <span className="font-dm-sans text-sm text-text-primary">Dark mode</span>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={handleToggle}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          isDark
            ? 'bg-[var(--toggle-on)] hover:bg-[var(--toggle-on-hover)]'
            : 'bg-border-default hover:bg-border-strong',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-bg-surface shadow-sm transition-transform',
            isDark ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

function MobileLink({
  href,
  label,
  pathname,
  onClose,
}: {
  href: string
  label: string
  pathname: string
  onClose: () => void
}) {
  const isActive = isActivePath(pathname, href)
  return (
    <Link
      href={href}
      onClick={onClose}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'block rounded-md px-2 py-2 font-dm-sans text-base',
        isActive
          ? 'bg-brand-subtle text-brand-subtle-text'
          : 'text-text-primary',
      )}
    >
      {label}
    </Link>
  )
}

function AccountMenu({
  user,
  onClose,
}: {
  user: NavUser
  onClose: () => void
}) {
  const items = [
    { href: '/library', label: 'My library' },
    { href: '/diary', label: 'Reading diary' },
    { href: '/stats', label: 'Stats' },
    { href: '/goals', label: 'Goals' },
    { href: '/vocabulary', label: 'Vocabulary' },
    { href: '/my-lists', label: 'My lists' },
    { href: '/buddy-reads', label: 'Buddy reads' },
    { href: '/saved-posts', label: 'Saved posts' },
    { href: '/commonplace', label: 'Commonplace book' },
  ]
  const showPlusBadge = user.subscription_tier === 'free'
  return (
    <div
      role="menu"
      className={cn(
        'absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated shadow-md',
      )}
    >
      <div className="border-b border-border-subtle px-4 py-3">
        <p className="font-dm-sans text-sm font-medium text-text-primary">
          {user.display_name}
        </p>
        <p className="font-dm-mono text-xs text-text-tertiary">
          @{user.username}
        </p>
      </div>
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
          <Link
            href="/find-next-book"
            role="menuitem"
            className="flex items-center justify-between gap-2 px-4 py-2 font-dm-sans text-sm text-text-primary hover:bg-bg-hover"
            onClick={onClose}
          >
            <span>Find next book</span>
            {showPlusBadge && (
              <span className="rounded-full bg-brand-subtle px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-wider text-brand-subtle-text">
                Plus
              </span>
            )}
          </Link>
        </li>
        <li className="border-t border-border-subtle">
          <Link
            href={`/u/${user.username}`}
            role="menuitem"
            className="block px-4 py-2 font-dm-sans text-sm text-text-primary hover:bg-bg-hover"
            onClick={onClose}
          >
            Profile
          </Link>
        </li>
        <li>
          <Link
            href="/settings"
            role="menuitem"
            className="block px-4 py-2 font-dm-sans text-sm text-text-primary hover:bg-bg-hover"
            onClick={onClose}
          >
            Settings
          </Link>
        </li>
        {user.is_admin && (
          <li>
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
