'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import {
  BarChartIcon,
  BookMenuIcon,
  GearIcon,
  LogoutIcon,
  PersonIcon,
  ShieldIcon,
  StackIcon,
  TargetIcon,
  WandIcon,
} from '@/components/icons'
import { cn } from '@/lib/cn'
import type { MenuStats } from '@/lib/user-queries-types'

export interface NavUser {
  username: string
  display_name: string
  avatar_url: string | null
  is_admin: boolean
  subscription_tier: 'free' | 'plus'
}

export function AccountMenu({
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
        'absolute right-0 top-12 z-50 w-96 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated shadow-md max-h-[calc(100dvh-80px)] overflow-y-auto',
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
                <span className="ml-1 rounded-full bg-brand-subtle px-1.5 py-0.5 font-dm-mono text-[0.625rem] text-brand-text">
                  Plus
                </span>
              ) : (
                <span className="ml-1 rounded-full border border-border-subtle px-1.5 py-0.5 font-dm-mono text-[0.625rem] text-text-tertiary">
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
          icon={<BarChartIcon size={16} />}
          label="Stats"
          onClose={onClose}
        />
        <MenuItem
          href="/goals"
          icon={<TargetIcon size={16} />}
          label="Goals"
          subLabel={goalSubLabel}
          onClose={onClose}
        />
        <MenuItem
          href="/vocabulary"
          icon={<BookMenuIcon size={16} />}
          label="Vocabulary"
          subLabel={vocabSubLabel}
          onClose={onClose}
        />
        <MenuItem
          href="/saved-posts"
          icon={<StackIcon size={16} />}
          label="Collections"
          subLabel={"Lists · buddy reads · saved · commonplace"}
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
            <WandIcon size={16} />
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
            <span className="ml-auto rounded-full bg-brand-subtle px-2 py-0.5 font-dm-mono text-[0.625rem] uppercase tracking-wider text-brand-subtle-text">
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
              <ShieldIcon size={14} />
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
          className="flex cursor-pointer flex-col items-center gap-1 px-2 py-2.5 font-dm-sans text-[0.6875rem] text-text-secondary hover:bg-bg-hover"
        >
          <PersonIcon size={15} />
          Profile
        </Link>
        <Link
          href="/settings"
          role="menuitem"
          onClick={onClose}
          className="flex cursor-pointer flex-col items-center gap-1 border-l border-border-subtle px-2 py-2.5 font-dm-sans text-[0.6875rem] text-text-secondary hover:bg-bg-hover"
        >
          <GearIcon size={15} />
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
            className="flex cursor-pointer flex-col items-center gap-1 border-l border-border-subtle px-2 py-2.5 font-dm-sans text-[0.6875rem] text-text-secondary hover:bg-bg-hover hover:text-error"
          >
            <LogoutIcon size={15} />
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
      <span className="mt-1 font-dm-mono text-[0.625rem] uppercase tracking-wide text-text-tertiary">
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
