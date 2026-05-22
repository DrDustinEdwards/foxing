'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/cn'
import type { MenuStats } from '@/lib/user-queries-types'

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
  { href: '/journal', label: 'Journal', match: '/journal' },
  { href: '/people', label: 'People', match: '/people' },
] as const

interface ActiveBOTM {
  title: string
  author: string
  slug: string | null
  curator_note: string | null
}

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
  const [botm, setBotm] = useState<ActiveBOTM | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/botm/active')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ActiveBOTM | null) => {
        if (!cancelled && data) setBotm(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
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
            <span aria-hidden="true">🦊</span>
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
                    botm={botm}
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover"
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
            <>
              <Link
                href="/sign-in"
                className="inline-flex items-center font-dm-sans text-sm text-text-secondary hover:text-text-primary md:hidden"
              >
                Sign in
              </Link>
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
            </>
          )}

          {!user && (
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover md:hidden"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <HamburgerIcon open={mobileOpen} />
            </button>
          )}
        </div>
      </nav>

      {!user && (
        <div className="border-t border-border-subtle bg-bg-sunken md:hidden">
          <ul className="mx-auto flex h-10 w-full max-w-page items-center gap-1 overflow-x-auto scrollbar-none px-6">
            {PRIMARY_LINKS.map((link) => {
              const isActive = isActivePath(pathname, link.match)
              return (
                <li key={link.href} className="shrink-0">
                  <Link
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-7 items-center rounded-md px-3 font-dm-sans text-xs',
                      isActive
                        ? 'bg-brand-subtle text-brand-subtle-text'
                        : 'text-text-tertiary hover:text-text-primary',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {user && <SecondaryAuthBar pathname={pathname} />}

      {!user && (
        <MobileDrawer
          open={mobileOpen}
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
    <div className="border-t border-border-subtle bg-bg-sunken md:block">
      <ul className="mx-auto flex h-10 w-full max-w-page items-center gap-1 overflow-x-auto scrollbar-none px-6">
        {items.map((item) => {
          const isActive = isActivePath(pathname, item.href)
          return (
            <li key={item.href} className="shrink-0">
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
        <li className="ml-auto flex shrink-0 items-center pl-4">
          <MobileThemePicker compact />
        </li>
      </ul>
    </div>
  )
}

function MegaMenu({
  kind,
  botm,
  onLinkClick,
}: {
  kind: 'books' | 'book-clubs'
  botm: ActiveBOTM | null
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

  const monthYearLabel = new Date().toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="absolute left-1/2 top-9 z-50 w-[440px] -translate-x-1/2 rounded-lg border border-border-subtle bg-bg-elevated p-5 shadow-lg">
      {botm ? (
        <div className="mb-3 rounded-md border border-border-subtle bg-bg-sunken p-3">
          <p className="font-dm-mono text-[10px] uppercase tracking-wider text-brand-text">
            Foxing pick · {monthYearLabel}
          </p>
          <p className="mt-1 font-fraunces text-sm text-text-primary">
            {botm.title}
          </p>
          <p className="font-dm-sans text-xs text-text-tertiary">
            {botm.author}
          </p>
          <Link
            href="/book-of-the-month"
            onClick={onLinkClick}
            role="menuitem"
            className="mt-2 inline-block font-dm-sans text-xs text-brand-text hover:underline"
          >
            See curator notes →
          </Link>
        </div>
      ) : null}
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
        <Link
          href="/book-of-the-month"
          onClick={onLinkClick}
          role="menuitem"
          className="block rounded-md px-2 py-1.5 font-dm-sans text-sm text-brand-text hover:bg-bg-hover"
        >
          All monthly picks
        </Link>
      </div>
    </div>
  )
}

function MobileDrawer({
  open,
  pathname,
  onClose,
}: {
  open: boolean
  pathname: string
  onClose: () => void
}) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const discoverLinks = [
    { href: '/books', label: 'Books' },
    { href: '/discover', label: 'By Mood' },
    { href: '/awards', label: 'Award Winners' },
    { href: '/challenges', label: 'Reading Challenges' },
  ]

  const communityLinks = [
    { href: '/book-clubs', label: 'Book Clubs' },
    { href: '/clubs', label: 'Reading Clubs' },
    { href: '/people', label: 'People' },
    { href: '/journal', label: 'Journal' },
  ]

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40"
        />
      )}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-bg-surface shadow-xl transition-transform duration-250 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex justify-end p-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover"
          >
            <HamburgerIcon open={true} />
          </button>
        </div>

        <p className="px-5 pb-2 pt-5 font-dm-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
          Discover
        </p>
        <ul>
          {discoverLinks.map((link) => (
            <li key={link.href}>
              <DrawerLink
                href={link.href}
                label={link.label}
                pathname={pathname}
                onClose={onClose}
              />
            </li>
          ))}
        </ul>

        <p className="px-5 pb-2 pt-5 font-dm-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
          Community
        </p>
        <ul>
          {communityLinks.map((link) => (
            <li key={link.href}>
              <DrawerLink
                href={link.href}
                label={link.label}
                pathname={pathname}
                onClose={onClose}
              />
            </li>
          ))}
        </ul>

        <div className="flex-1" />

        <div className="flex flex-col gap-3 border-t border-border-subtle p-5">
          <MobileThemePicker />
          <div className="flex gap-2">
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
          </div>
        </div>
      </aside>
    </>
  )
}

function MobileThemePicker({ compact = false }: { compact?: boolean }) {
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

  if (compact) {
    return (
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

function DrawerLink({
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
        'block px-5 py-3 font-dm-sans text-base hover:bg-bg-hover',
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
  const [stats, setStats] = useState<MenuStats | null>(null)
  const isPlus = user.subscription_tier === 'plus'

  useEffect(() => {
    let cancelled = false
    fetch('/api/menu-stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MenuStats | null) => {
        if (!cancelled && data) setStats(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user.username])

  const goalSubLabel =
    stats && stats.goalTarget !== null
      ? `${stats.goalProgress} of ${stats.goalTarget} this year · ${stats.freezeCredits} freeze${stats.freezeCredits !== 1 ? 's' : ''} left`
      : null

  const vocabSubLabel = stats
    ? stats.vocabularyUnmastered > 0
      ? `${stats.vocabularyUnmastered} word${stats.vocabularyUnmastered !== 1 ? 's' : ''} to master`
      : stats.vocabularyTotal > 0
        ? `All ${stats.vocabularyTotal} words mastered`
        : null
    : null

  return (
    <div
      role="menu"
      className={cn(
        'absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated shadow-md max-h-[calc(100dvh-80px)] overflow-y-auto',
      )}
    >
      <div className="bg-bg-sunken px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar
            src={user.avatar_url}
            name={user.display_name}
            size="md"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate font-dm-sans text-sm font-medium text-text-primary">
              {user.display_name}
              {isPlus ? (
                <span className="ml-1 rounded-full bg-brand-subtle px-1.5 py-0.5 font-dm-mono text-[10px] text-brand-text">
                  Plus
                </span>
              ) : (
                <span className="ml-1 rounded-full border border-border-subtle px-1.5 py-0.5 font-dm-mono text-[10px] text-text-tertiary">
                  Free
                </span>
              )}
            </p>
            <p className="truncate font-dm-mono text-xs text-text-tertiary">
              @{user.username}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-md border border-border-subtle bg-bg-surface">
          <StatTile
            value={stats?.booksThisYear ?? '-'}
            label="books this year"
          />
          <StatTile
            value={stats?.currentStreak ?? '-'}
            label="day streak"
            divider
          />
          <StatTile
            value={stats?.totalHighlights ?? '-'}
            label="highlights"
            divider
          />
        </div>
      </div>

      <div className="border-t border-border-subtle py-1">
        <MenuItem
          href="/stats"
          icon={<BarChartIcon />}
          label="Stats"
          onClose={onClose}
        />
        <MenuItem
          href="/goals"
          icon={<TargetIcon />}
          label="Goals"
          subLabel={goalSubLabel}
          onClose={onClose}
        />
        <MenuItem
          href="/vocabulary"
          icon={<BookMenuIcon />}
          label="Vocabulary"
          subLabel={vocabSubLabel}
          onClose={onClose}
        />
        <MenuItem
          href="/saved-posts"
          icon={<StackIcon />}
          label="Collections"
          subLabel="Lists · buddy reads · saved · commonplace"
          onClose={onClose}
        />

        <div className="my-1 border-t border-border-subtle" />

        <Link
          href="/find-next-book"
          role="menuitem"
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-2 text-text-secondary hover:bg-bg-hover"
        >
          <span className="text-text-secondary">
            <WandIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-dm-sans text-sm text-text-primary">
              Find next book
            </p>
            {isPlus ? (
              <p className="mt-0.5 font-dm-sans text-xs text-text-tertiary">
                AI recommendations for you
              </p>
            ) : null}
          </div>
          {!isPlus ? (
            <span className="ml-auto rounded-full bg-brand-subtle px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-wider text-brand-subtle-text">
              Plus
            </span>
          ) : null}
        </Link>

        {user.is_admin ? (
          <>
            <div className="my-1 border-t border-border-subtle" />
            <Link
              href="/admin"
              role="menuitem"
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-2 text-brand-text hover:bg-bg-hover"
            >
              <ShieldIcon />
              <span className="font-dm-sans text-sm">Admin dashboard</span>
            </Link>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-3 border-t border-border-subtle">
        <Link
          href={`/u/${user.username}`}
          role="menuitem"
          onClick={onClose}
          className="flex cursor-pointer flex-col items-center gap-1 px-2 py-2.5 font-dm-sans text-[11px] text-text-secondary hover:bg-bg-hover"
        >
          <PersonIcon />
          Profile
        </Link>
        <Link
          href="/settings"
          role="menuitem"
          onClick={onClose}
          className="flex cursor-pointer flex-col items-center gap-1 border-l border-border-subtle px-2 py-2.5 font-dm-sans text-[11px] text-text-secondary hover:bg-bg-hover"
        >
          <GearIcon />
          Settings
        </Link>
        <form
          action="/sign-out"
          method="post"
          className="contents"
        >
          <button
            type="submit"
            role="menuitem"
            className="flex cursor-pointer flex-col items-center gap-1 border-l border-border-subtle px-2 py-2.5 font-dm-sans text-[11px] text-text-secondary hover:bg-bg-hover hover:text-error"
          >
            <LogoutIcon />
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}

function StatTile({
  value,
  label,
  divider,
}: {
  value: number | string
  label: string
  divider?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-2 py-2.5 text-center',
        divider ? 'border-l border-border-subtle' : '',
      )}
    >
      <span className="font-fraunces text-lg leading-none text-text-primary">
        {value}
      </span>
      <span className="mt-1 font-dm-mono text-[10px] uppercase tracking-wide text-text-tertiary">
        {label}
      </span>
    </div>
  )
}

function MenuItem({
  href,
  icon,
  label,
  subLabel,
  onClose,
}: {
  href: string
  icon: React.ReactNode
  label: string
  subLabel?: string | null
  onClose: () => void
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClose}
      className="flex items-center gap-3 px-4 py-2 text-text-secondary hover:bg-bg-hover"
    >
      <span className="text-text-secondary">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-dm-sans text-sm text-text-primary">{label}</p>
        {subLabel ? (
          <p className="mt-0.5 font-dm-sans text-xs text-text-tertiary">
            {subLabel}
          </p>
        ) : null}
      </div>
    </Link>
  )
}

function BarChartIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M3 20v-5M8 20V10M13 20V4M18 20v-8" strokeLinecap="round" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function BookMenuIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function StackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

function WandIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M15 4l5 5-11 11H4v-5L15 4z" />
      <path d="M14 7l3 3" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
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
