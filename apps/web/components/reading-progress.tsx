'use client'

import { useEffect, useState } from 'react'

/**
 * Fixed 2px progress bar that tracks vertical scroll position. Hidden
 * until the page is tall enough to actually scroll so it does not flash
 * on short articles.
 */
export function ReadingProgress() {
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    function update() {
      const max = document.body.scrollHeight - window.innerHeight
      if (max <= 0) {
        setPercent(0)
        return
      }
      const next = Math.min(100, Math.max(0, (window.scrollY / max) * 100))
      setPercent(next)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: 2,
        width: `${percent}%`,
        background: 'var(--brand-ui)',
        zIndex: 50,
        transition: 'width 80ms linear',
      }}
    />
  )
}
