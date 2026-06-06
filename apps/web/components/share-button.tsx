'use client'

import { Button } from '@/components/ui/button'
import { ShareIcon } from '@/components/icons'
import { useTimedFlag } from '@/hooks/use-timed-flag'

interface ShareButtonProps {
  url: string
  text?: string
}

export function ShareButton({ url, text }: ShareButtonProps) {
  const [copied, triggerCopied] = useTimedFlag()

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
      triggerCopied()
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
