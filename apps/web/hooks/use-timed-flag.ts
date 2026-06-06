'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useTimedFlag(duration = 2000): [boolean, () => void] {
  const [flag, setFlag] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const trigger = useCallback(() => {
    setFlag(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFlag(false), duration)
  }, [duration])

  return [flag, trigger]
}
