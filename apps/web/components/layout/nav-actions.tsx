'use client'

import type { Dispatch, RefObject, SetStateAction } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { BellIcon, HamburgerIcon, SearchIcon } from '@/components/icons'
import { openCommandPalette } from '@/components/search/command-palette'
import { AccountMenu, type NavUser } from './account-menu'

export function NavActions({
  user,
  unreadNotifications,
  menuOpen,
  setMenuOpen,
  mobileOpen,
  setMobileOpen,
  accountRef,
}: {
  user: NavUser | null
  unreadNotifications: number
  menuOpen: boolean
  setMenuOpen: Dispatch<SetStateAction<boolean>>
  mobileOpen: boolean
  setMobileOpen: Dispatch<SetStateAction<boolean>>
  accountRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => openCommandPalette()}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover"
        aria-label="Search"
      >
        <SearchIcon size={18} />
      </button>

      <ThemeToggle className="inline-flex" />

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
            <BellIcon size={18} />
            {unreadNotifications > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-ui px-1 font-dm-mono text-[0.625rem] font-medium text-text-on-amber"
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
          <HamburgerIcon size={20} open={mobileOpen} />
        </button>
      )}
    </div>
  )
}
