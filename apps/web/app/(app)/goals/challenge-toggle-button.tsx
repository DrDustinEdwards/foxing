'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { joinChallenge, leaveChallenge } from './challenge-actions'

interface ChallengeToggleButtonProps {
  challengeId: string
  initiallyJoined: boolean
}

export function ChallengeToggleButton({
  challengeId,
  initiallyJoined,
}: ChallengeToggleButtonProps) {
  const [joined, setJoined] = useState(initiallyJoined)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const previous = joined
    const next = !previous
    setJoined(next)
    startTransition(() => {
      void (previous ? leaveChallenge(challengeId) : joinChallenge(challengeId)).then(
        (res) => {
          if (!res.ok) setJoined(previous)
        },
      )
    })
  }

  return (
    <Button
      variant={joined ? 'secondary' : 'primary'}
      size="sm"
      onClick={toggle}
      disabled={pending}
    >
      {joined ? 'Leave' : 'Join'}
    </Button>
  )
}
