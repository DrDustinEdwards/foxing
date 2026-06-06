'use client'

import { useEffect, useState } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { LikeHighlightButton } from '@/components/ui/like-highlight-button'

interface Props {
  quoteId: string
  initialCount: number
}

export function QuoteLikeButton({ quoteId, initialCount }: Props) {
  const { user, isLoading } = useSession()
  const [liked, setLiked] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      setLiked(false)
      setLoaded(true)
      return
    }
    let cancelled = false
    fetch(`/api/me/quote/${quoteId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setLiked(Boolean(data.liked))
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [quoteId, user, isLoading])

  if (!loaded) return null

  return (
    <LikeHighlightButton
      highlightId={quoteId}
      initialLiked={liked}
      initialCount={initialCount}
      userId={user?.id ?? null}
    />
  )
}
