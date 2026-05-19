'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { markAllRead } from './actions'

export function MarkAllReadButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        await markAllRead()
        setPending(false)
        router.refresh()
      }}
      className="font-dm-sans text-sm text-brand-text hover:underline disabled:opacity-50"
    >
      {pending ? 'Marking...' : 'Mark all read'}
    </button>
  )
}
