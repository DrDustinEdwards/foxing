'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { setAnnouncementPinned } from './actions'

export function PinAnnouncementButton({
  id,
  clubId,
  pinned,
}: {
  id: string
  clubId: string
  pinned: boolean
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setSaving(true)
    const fd = new FormData()
    fd.set('id', id)
    fd.set('club_id', clubId)
    // Toggle: send 'on' to pin, omit to unpin.
    if (!pinned) fd.set('pinned', 'on')
    const res = await setAnnouncementPinned(fd)
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={saving}
        className="font-dm-sans text-xs text-text-tertiary hover:text-text-primary disabled:opacity-50"
      >
        {saving ? '...' : pinned ? 'Unpin' : 'Pin'}
      </button>
      {error && <span className="font-dm-sans text-xs text-error">{error}</span>}
    </span>
  )
}
