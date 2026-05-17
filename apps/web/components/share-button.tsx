'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ShareIcon } from '@/components/icons'

interface ShareButtonProps {
  url: string
  text?: string
}

export function ShareButton({ url, text }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleClick() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as Navigator).share({ url, text })
        return
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick}>
      <ShareIcon size={16} />
      {copied ? 'Copied' : 'Share'}
    </Button>
  )
}
