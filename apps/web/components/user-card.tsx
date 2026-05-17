'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/types/database'

interface UserCardProps {
  profile: Pick<
    Profile,
    'username' | 'display_name' | 'avatar_url' | 'reading_personality'
  >
  tasteMatch?: number | null
  isFollowing?: boolean
  onFollowToggle?: (next: boolean) => void
}

export function UserCard({
  profile,
  tasteMatch,
  isFollowing,
  onFollowToggle,
}: UserCardProps) {
  const [following, setFollowing] = useState(isFollowing ?? false)

  function handleClick() {
    const next = !following
    setFollowing(next)
    onFollowToggle?.(next)
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <Link href={`/u/${profile.username}`} className="shrink-0">
        <Avatar
          src={profile.avatar_url}
          name={profile.display_name}
          size="md"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <Link
            href={`/u/${profile.username}`}
            className="font-dm-sans text-sm font-medium text-text-primary hover:text-brand-text"
          >
            {profile.display_name}
          </Link>
          <span className="font-dm-sans text-xs text-text-tertiary">
            @{profile.username}
          </span>
        </div>
        {profile.reading_personality && (
          <p className="font-source-serif-4 text-sm italic text-text-tertiary">
            {profile.reading_personality}
          </p>
        )}
        {typeof tasteMatch === 'number' && (
          <Badge variant="brand" className="mt-1 w-fit">
            {tasteMatch}% taste match
          </Badge>
        )}
      </div>
      {onFollowToggle && (
        <Button
          variant={following ? 'secondary' : 'primary'}
          size="sm"
          onClick={handleClick}
        >
          {following ? 'Following' : 'Follow'}
        </Button>
      )}
    </div>
  )
}
