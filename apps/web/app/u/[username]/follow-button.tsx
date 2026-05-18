'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toggleFollow } from './follow-action'

interface FollowButtonProps {
  targetUserId: string
  username: string
  initiallyFollowing: boolean
}

export function FollowButton({
  targetUserId,
  username,
  initiallyFollowing,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initiallyFollowing)
  const [isPending, startTransition] = useTransition()

  function onClick() {
    const previous = isFollowing
    const next = !previous
    setIsFollowing(next)
    startTransition(() => {
      void toggleFollow({
        targetUserId,
        username,
        isFollowing: previous,
      }).then((result) => {
        if (!result.ok) setIsFollowing(previous)
      })
    })
  }

  return (
    <Button
      variant={isFollowing ? 'secondary' : 'primary'}
      size="sm"
      onClick={onClick}
      disabled={isPending}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  )
}
