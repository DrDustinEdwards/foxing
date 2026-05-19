'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useStreakFreeze } from './actions'

export function UseFreezeButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={pending}
        onClick={async () => {
          setError(null)
          setPending(true)
          const res = await useStreakFreeze()
          setPending(false)
          if (!res.ok) {
            setError(res.error)
            return
          }
          router.refresh()
        }}
      >
        Use a freeze
      </Button>
      {error && (
        <p className="font-dm-sans text-xs text-error">{error}</p>
      )}
    </div>
  )
}
