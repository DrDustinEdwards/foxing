'use client'

import Link from 'next/link'
import { createContext, useContext, useEffect, useState } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { Badge } from '@/components/ui/badge'
import { FollowButton } from './follow-button'

interface TasteSummary {
  percent: number
  shared: number
}

interface OwnLevel {
  label: string
  xp: number
}

interface MeProfileState {
  loaded: boolean
  viewerId: string | null
  isOwnProfile: boolean
  isFollowing: boolean
  taste: TasteSummary | null
  ownLevel: OwnLevel | null
}

const EMPTY: MeProfileState = {
  loaded: false,
  viewerId: null,
  isOwnProfile: false,
  isFollowing: false,
  taste: null,
  ownLevel: null,
}

const EMPTY_LOADED: MeProfileState = { ...EMPTY, loaded: true }

const MeProfileContext = createContext<MeProfileState>(EMPTY)

export function MeProfileProvider({
  profileId,
  children,
}: {
  profileId: string
  children: React.ReactNode
}) {
  const { user, isLoading } = useSession()
  const [state, setState] = useState<MeProfileState>(EMPTY)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      setState(EMPTY_LOADED)
      return
    }
    let cancelled = false
    fetch(`/api/me/profile/${profileId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setState({ loaded: true, ...(data as Omit<MeProfileState, 'loaded'>) })
      })
      .catch(() => {
        if (!cancelled) setState(EMPTY_LOADED)
      })
    return () => {
      cancelled = true
    }
  }, [profileId, user, isLoading])

  return (
    <MeProfileContext.Provider value={state}>
      {children}
    </MeProfileContext.Provider>
  )
}

function useMeProfile() {
  return useContext(MeProfileContext)
}

export function OwnLevelBadge() {
  const { ownLevel } = useMeProfile()
  if (!ownLevel) return null
  return (
    <span
      title={`${ownLevel.xp} XP`}
      className="inline-flex items-center rounded-full bg-brand-subtle px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-wider text-brand-subtle-text"
    >
      {ownLevel.label}
    </span>
  )
}

export function TasteBadge() {
  const { taste } = useMeProfile()
  if (!taste) return null
  return (
    <Badge variant="brand" className="mt-2 w-fit">
      {taste.shared === 0
        ? 'No book overlap yet'
        : `${taste.percent}% taste match`}
    </Badge>
  )
}

export function ViewerActions({
  profileId,
  username,
}: {
  profileId: string
  username: string
}) {
  const { viewerId, isOwnProfile, isFollowing, loaded } = useMeProfile()
  if (!loaded || !viewerId || isOwnProfile) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/u/${username}/compare`}
        className="inline-flex h-9 items-center rounded-md border border-border-interactive bg-bg-surface px-3 font-dm-sans text-sm text-text-primary hover:bg-bg-hover"
      >
        Compare stats
      </Link>
      <FollowButton
        targetUserId={profileId}
        username={username}
        initiallyFollowing={isFollowing}
      />
    </div>
  )
}
