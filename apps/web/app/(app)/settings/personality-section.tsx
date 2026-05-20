'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { regenerateReadingPersonality } from './personality-actions'

interface Props {
  initial: string | null
}

export function PersonalitySection({ initial }: Props) {
  const router = useRouter()
  const [current, setCurrent] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setPending(true)
    const res = await regenerateReadingPersonality()
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setCurrent(res.personality)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-source-serif-4 text-sm text-text-secondary">
        Your reading personality is auto-generated from your finished books.
      </p>
      {current ? (
        <p className="rounded-md border border-border-subtle bg-bg-sunken px-3 py-2 font-source-serif-4 italic text-text-primary">
          {current}
        </p>
      ) : (
        <p className="font-source-serif-4 text-sm text-text-tertiary">
          No personality yet.
        </p>
      )}
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleClick}
          loading={pending}
        >
          Regenerate
        </Button>
      </div>
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}
